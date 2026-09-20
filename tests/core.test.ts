import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const testRoot = mkdtempSync(path.join(os.tmpdir(), "meloday-tests-"));
process.env.MELODAY_DATABASE_PATH = path.join(testRoot, "meloday.sqlite");
process.env.MELODAY_MEDIA_DIR = path.join(testRoot, "media");
process.env.MELODAY_PROVIDER_MODE = "fake";

type Runtime = {
  types: typeof import("../src/lib/types");
  auth: typeof import("../src/server/auth");
  errors: typeof import("../src/server/errors");
  repositories: typeof import("../src/server/repositories");
  providers: typeof import("../src/server/providers");
  media: typeof import("../src/server/media");
  generation: typeof import("../src/server/generation");
  database: typeof import("../src/server/db");
};

let runtime: Runtime | null = null;
let types: Runtime["types"];
let auth: Runtime["auth"];
let errors: Runtime["errors"];
let repositories: Runtime["repositories"];
let providers: Runtime["providers"];
let media: Runtime["media"];
let generation: Runtime["generation"];
let database: Runtime["database"];

async function loadRuntime(): Promise<void> {
  if (runtime) return;
  runtime = {
    types: await import("../src/lib/types"),
    auth: await import("../src/server/auth"),
    errors: await import("../src/server/errors"),
    repositories: await import("../src/server/repositories"),
    providers: await import("../src/server/providers"),
    media: await import("../src/server/media"),
    generation: await import("../src/server/generation"),
    database: await import("../src/server/db"),
  };
  ({ types, auth, errors, repositories, providers, media, generation, database } = runtime);
}

function assertHttpError(error: unknown, code: string): true {
  assert.ok(error instanceof errors.HttpError);
  assert.equal(error.code, code);
  return true;
}

after(async () => {
  await loadRuntime();
  database.getDb().close();
  rmSync(testRoot, { recursive: true, force: true });
});

test("password hashing and cookie sessions", async () => {
  await loadRuntime();
  repositories.resetSchemaForTests();
  const passwordHash = await auth.hashPassword("correct horse battery");
  assert.match(passwordHash, /^scrypt-v1\$[^$]+\$[0-9a-f]+$/);
  assert.equal(await auth.verifyPassword("correct horse battery", passwordHash), true);
  assert.equal(await auth.verifyPassword("wrong password", passwordHash), false);

  const user = repositories.createUser({ username: "alice", displayName: "Alice", passwordHash });
  assert.equal(user.agentName, "alice");
  const token = auth.createSessionCookie(user.id);
  const request = new Request("http://localhost/api/me", { headers: { cookie: `${auth.SESSION_COOKIE}=${token}` } });
  assert.equal(auth.getRequestUser(request)?.id, user.id);
  auth.clearSessionCookie(request);
  assert.equal(auth.getRequestUser(request), null);
});

test("agent JSON, intent, state merge and provider decoders", async () => {
  await loadRuntime();
  const parsed = providers.parseJsonObject("```json\n{\"ok\":true}\n```");
  assert.deepEqual(parsed, { ok: true });
  assert.throws(() => providers.parseJsonObject("not json"), (error) => error instanceof providers.ProviderError);

  const reply = await providers.generateAgentTurn({
    userName: "Alice",
    userMessage: "开始生成吧",
    state: types.DEFAULT_AGENT_STATE,
    draft: types.EMPTY_DIARY_DRAFT,
    recentMessages: [],
  });
  assert.equal(reply.shouldGenerate, true);
  assert.equal(reply.generationReason, "用户主动要求生成");
  assert.ok(reply.replyParts.length <= 3);

  const naturalRegenerationReply = await providers.generateAgentTurn({
    userName: "Alice",
    userMessage: "换成更轻快的音乐",
    state: types.DEFAULT_AGENT_STATE,
    draft: types.EMPTY_DIARY_DRAFT,
    recentMessages: [],
  });
  assert.equal(naturalRegenerationReply.shouldGenerate, true);

  const identityReply = await providers.generateAgentTurn({
    userName: "Alice",
    userMessage: "我是谁",
    state: types.DEFAULT_AGENT_STATE,
    draft: types.EMPTY_DIARY_DRAFT,
    recentMessages: [],
  });
  assert.equal(identityReply.replyParts[0], "我记得，你叫 Alice。");

  const merged = types.mergeAgentState(types.DEFAULT_AGENT_STATE, {
    emotion: "平静",
    completeness: 4,
    importantDetails: ["一", "一", "二"],
    musicDirection: { tempo: "慢速", instruments: ["钢琴"] },
  });
  assert.equal(merged.completeness, 1);
  assert.deepEqual(merged.importantDetails, ["一", "二"]);
  assert.deepEqual(merged.musicDirection.instruments, ["钢琴"]);
  assert.equal(types.draftText({ stableText: "前文", recentText: "最近", userTurnCount: 2, turnsSinceOrganization: 1 }), "前文\n\n最近");

  const organized = await providers.organizeRecentDiary({ stableText: "", recentMessages: [{ id: "1", role: "user", content: "嗯，然后去了公园", createdAt: "" }] });
  assert.equal(organized, "去了公园");
  const card = await providers.finalizeDiary({ draftText: "今天去了公园。", state: types.DEFAULT_AGENT_STATE });
  assert.equal(card.title, "今天，慢慢记下来的光");

  assert.deepEqual(providers.decodeHexAudio("ff00"), Buffer.from([0xff, 0x00]));
  assert.deepEqual(providers.decodeBase64Image(Buffer.from("image").toString("base64")), Buffer.from("image"));
  assert.throws(() => providers.decodeHexAudio("fg"), (error) => error instanceof providers.ProviderError);
  assert.throws(() => providers.decodeBase64Image("not base64?"), (error) => error instanceof providers.ProviderError);
});

test("sessions contain only diary state and messages", async () => {
  await loadRuntime();
  repositories.resetSchemaForTests();
  const user = repositories.createUser({ username: "sessionuser", displayName: "Session", passwordHash: "test-hash" });
  const sessionId = repositories.createActiveSession({ userId: user.id, expiresAt: new Date(Date.now() + 86400000).toISOString() });
  repositories.touchActiveSession(sessionId, { state: types.DEFAULT_AGENT_STATE, draft: types.EMPTY_DIARY_DRAFT, expiresAt: new Date(Date.now() + 86400000).toISOString() });
  const session = repositories.getActiveSession(sessionId, user.id);
  assert.ok(session);
  assert.deepEqual(Object.keys(session).sort(), ["createdAt", "draft", "expiresAt", "id", "lastActivityAt", "state", "status", "userId"]);
});

test("capacity, saved-generation retention and media privacy", async () => {
  await loadRuntime();
  repositories.resetSchemaForTests();
  const user = repositories.createUser({ username: "owner", displayName: "Owner", passwordHash: await auth.hashPassword("owner password") });
  const other = repositories.createUser({ username: "other", displayName: "Other", passwordHash: await auth.hashPassword("other password") });
  database.getDb().prepare("UPDATE users SET diary_limit = 1 WHERE id = ?").run(user.id);

  const sessionId = repositories.createActiveSession({ userId: user.id, expiresAt: new Date(Date.now() + 86400000).toISOString() });
  const audioAssetId = await media.writeMedia("audio", user.id, Buffer.from("audio"), "audio/mpeg", "mp3");
  const job = repositories.createGenerationJob({ sessionId, userId: user.id, musicDirection: types.DEFAULT_AGENT_STATE.musicDirection });
  repositories.updateGenerationContent(job.id, { title: "一页", summary: "摘要", body: "正文", musicDirection: types.DEFAULT_AGENT_STATE.musicDirection });
  repositories.setGenerationAsset(job.id, "audio", audioAssetId);
  repositories.completeGeneration(job.id);

  const saved = generation.saveGeneration(job.id, user.id);
  assert.equal(saved.title, "一页");
  assert.ok(repositories.getGenerationJob(job.id, user.id));
  assert.ok(repositories.getDiaryEntry(saved.id, user.id));
  assert.equal(repositories.getGenerationJob(job.id, other.id), null);
  assert.equal(repositories.getDiaryEntry(saved.id, other.id), null);
  await assert.rejects(() => media.readMediaForUser(audioAssetId, other.id), (error) => assertHttpError(error, "MEDIA_NOT_FOUND"));
  await assert.rejects(() => media.readMediaForUser(audioAssetId, null), (error) => assertHttpError(error, "MEDIA_NOT_FOUND"));

  repositories.publishDiaryEntry(saved.id, user.id);
  const publicMedia = await media.readMediaForUser(audioAssetId, null);
  assert.equal(publicMedia.buffer.toString(), "audio");

  const secondSession = repositories.createActiveSession({ userId: user.id, expiresAt: new Date(Date.now() + 86400000).toISOString() });
  const secondJob = repositories.createGenerationJob({ sessionId: secondSession, userId: user.id, musicDirection: types.DEFAULT_AGENT_STATE.musicDirection });
  repositories.updateGenerationContent(secondJob.id, { title: "二页", summary: "摘要", body: "正文", musicDirection: types.DEFAULT_AGENT_STATE.musicDirection });
  repositories.completeGeneration(secondJob.id);
  assert.throws(() => generation.saveGeneration(secondJob.id, user.id), (error) => assertHttpError(error, "CAPACITY_REACHED"));

  repositories.deleteDiaryEntry(saved.id, user.id);
  assert.equal(await media.removeOrphanedMedia(), 1);
  await assert.rejects(() => media.readMediaForUser(audioAssetId, user.id), (error) => assertHttpError(error, "MEDIA_NOT_FOUND"));
});

test("media storage rejects unsafe extensions", async () => {
  await loadRuntime();
  repositories.resetSchemaForTests();
  const user = repositories.createUser({ username: "mediauser", displayName: "Media", passwordHash: await auth.hashPassword("media password") });
  await assert.rejects(() => media.writeMedia("cover", user.id, Buffer.from("x"), "image/png", "../../"), (error) => assertHttpError(error, "INVALID_MEDIA_EXTENSION"));
});

test("API flow covers auth, three-turn organization, generation, save, publish and isolation", async () => {
  await loadRuntime();
  repositories.resetSchemaForTests();
  const registerRoute = await import("../src/app/api/auth/register/route");
  const loginRoute = await import("../src/app/api/auth/login/route");
  const logoutRoute = await import("../src/app/api/auth/logout/route");
  const meRoute = await import("../src/app/api/me/route");
  const sessionsRoute = await import("../src/app/api/sessions/route");
  const quickMusicRoute = await import("../src/app/api/quick-music/route");
  const sessionRoute = await import("../src/app/api/sessions/[id]/route");
  const messagesRoute = await import("../src/app/api/sessions/[id]/messages/route");
  const sessionGenerationRoute = await import("../src/app/api/sessions/[id]/generate/route");
  const generationRoute = await import("../src/app/api/generations/[id]/route");
  const saveRoute = await import("../src/app/api/generations/[id]/save/route");
  const regenerateRoute = await import("../src/app/api/generations/[id]/regenerate/route");
  const diaryRoute = await import("../src/app/api/diaries/[id]/route");
  const publishRoute = await import("../src/app/api/diaries/[id]/publish/route");
  const unpublishRoute = await import("../src/app/api/diaries/[id]/unpublish/route");
  const diariesRoute = await import("../src/app/api/diaries/route");
  const communityRoute = await import("../src/app/api/community/route");

  const jsonRequest = (url: string, method: string, body?: unknown, cookie?: string) => new Request(`http://localhost${url}`, {
    method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie: `${auth.SESSION_COOKIE}=${cookie}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // The route contract is intentionally generic; individual assertions narrow the returned data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const read = async (response: Response) => await response.json() as { data?: any; error?: { code: string; message: string } };
  const context = (id: string) => ({ params: Promise.resolve({ id }) });
  const getCookie = (response: Response) => decodeURIComponent(response.headers.get("set-cookie")?.match(new RegExp(`${auth.SESSION_COOKIE}=([^;]+)`))?.[1] ?? "");

  const registered = await registerRoute.POST(jsonRequest("/api/auth/register", "POST", { username: "apiuser", password: "api password", confirmPassword: "api password" }));
  assert.equal(registered.status, 200);
  const duplicate = await registerRoute.POST(jsonRequest("/api/auth/register", "POST", { username: "apiuser", password: "api password", confirmPassword: "api password" }));
  assert.equal(duplicate.status, 409);
  assert.equal((await registerRoute.POST(jsonRequest("/api/auth/register", "POST", { username: "mismatch", password: "api password", confirmPassword: "different password" }))).status, 400);
  assert.equal((await registerRoute.POST(jsonRequest("/api/auth/register", "POST", { username: "toolong99", password: "api password", confirmPassword: "api password" }))).status, 400);
  assert.equal((await loginRoute.POST(jsonRequest("/api/auth/login", "POST", { username: "apiuser", password: "wrong password" }))).status, 401);
  const loggedIn = await loginRoute.POST(jsonRequest("/api/auth/login", "POST", { username: "apiuser", password: "api password" }));
  assert.equal(loggedIn.status, 200);
  const cookie = getCookie(loggedIn);
  assert.ok(cookie);
  assert.equal((await read(await meRoute.GET(jsonRequest("/api/me", "GET", undefined, cookie)))).data.user.username, "apiuser");

  const quickMusic = (await read(await quickMusicRoute.POST(jsonRequest("/api/quick-music", "POST", { preset: "relax" }, cookie)))).data;
  assert.equal(quickMusic.session.state.musicDirection.tempo, "慢速");
  assert.equal(quickMusic.job.musicDirection.mood, "宁静、放松、治愈");
  assert.equal((await quickMusicRoute.POST(jsonRequest("/api/quick-music", "POST", { preset: "invalid" }, cookie))).status, 400);

  const createdSessionResponse = await sessionsRoute.POST(jsonRequest("/api/sessions", "POST", {}, cookie));
  const createdSession = (await read(createdSessionResponse)).data;
  assert.ok(createdSession.id);
  for (const content of ["早上去了河边", "风很轻，心情也慢慢安静下来", "我在长椅上听完了一首歌"])
    await messagesRoute.POST(jsonRequest(`/api/sessions/${createdSession.id}/messages`, "POST", { content }, cookie), context(createdSession.id));
  const organized = (await read(await sessionsRoute.GET(jsonRequest("/api/sessions", "GET", undefined, cookie)))).data;
  assert.equal(organized.draft.userTurnCount, 3);
  assert.equal(organized.draft.turnsSinceOrganization, 0);
  assert.ok(organized.draft.recentText);

  const queued = await sessionGenerationRoute.POST(jsonRequest(`/api/sessions/${createdSession.id}/generate`, "POST", {}, cookie), context(createdSession.id));
  const queuedJob = (await read(queued)).data;
  assert.ok(["queued", "running", "succeeded"].includes(queuedJob.status));
  let completed = queuedJob;
  for (let attempt = 0; attempt < 80 && !["succeeded", "failed"].includes(completed.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    completed = (await read(await generationRoute.GET(jsonRequest(`/api/generations/${queuedJob.id}`, "GET", undefined, cookie), context(queuedJob.id)))).data;
  }
  assert.equal(completed.status, "succeeded", completed.errorMessage ?? "generation did not succeed");
  const regenerated = (await read(await regenerateRoute.POST(jsonRequest(`/api/generations/${queuedJob.id}/regenerate`, "POST", { feedback: "更轻快一点" }, cookie), context(queuedJob.id)))).data;
  assert.equal(regenerated.parentGenerationId, queuedJob.id);
  let regeneratedCompleted = regenerated;
  for (let attempt = 0; attempt < 80 && !["succeeded", "failed"].includes(regeneratedCompleted.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    regeneratedCompleted = (await read(await generationRoute.GET(jsonRequest(`/api/generations/${regenerated.id}`, "GET", undefined, cookie), context(regenerated.id)))).data;
  }
  assert.equal(regeneratedCompleted.status, "succeeded", regeneratedCompleted.errorMessage ?? "regeneration did not succeed");
  assert.equal((await read(await generationRoute.GET(jsonRequest(`/api/generations/${queuedJob.id}`, "GET", undefined, cookie), context(queuedJob.id)))).data.status, "succeeded");
  const saved = (await read(await saveRoute.POST(jsonRequest(`/api/generations/${regenerated.id}/save`, "POST", {}, cookie), context(regenerated.id)))).data;
  assert.equal(saved.id, (await read(await diariesRoute.GET(jsonRequest("/api/diaries", "GET", undefined, cookie)))).data.entries[0].id);

  assert.equal((await read(await publishRoute.POST(jsonRequest(`/api/diaries/${saved.id}/publish`, "POST", {}, cookie), context(saved.id)))).data.publishedAt !== null, true);
  assert.equal((await read(await communityRoute.GET(jsonRequest("/api/community", "GET")))).data.items.length, 1);
  assert.equal((await read(await unpublishRoute.POST(jsonRequest(`/api/diaries/${saved.id}/unpublish`, "POST", {}, cookie), context(saved.id)))).data.publishedAt, null);

  const secondUserResponse = await registerRoute.POST(jsonRequest("/api/auth/register", "POST", { username: "second1", password: "second password", confirmPassword: "second password" }));
  const secondCookie = getCookie(secondUserResponse);
  assert.equal((await read(await diaryRoute.GET(jsonRequest(`/api/diaries/${saved.id}`, "GET", undefined, secondCookie), context(saved.id)))).data, null);
  assert.equal((await read(await generationRoute.GET(jsonRequest(`/api/generations/${regenerated.id}`, "GET", undefined, secondCookie), context(regenerated.id)))).error?.code, "GENERATION_NOT_FOUND");

  const secondSessionResponse = await sessionsRoute.POST(jsonRequest("/api/sessions", "POST", {}, secondCookie));
  const secondSession = (await read(secondSessionResponse)).data;
  assert.equal((await read(await sessionRoute.DELETE(jsonRequest(`/api/sessions/${secondSession.id}`, "DELETE", undefined, secondCookie), context(secondSession.id)))).data.ok, true);
  assert.equal((await read(await sessionRoute.GET(jsonRequest(`/api/sessions/${secondSession.id}`, "GET", undefined, secondCookie), context(secondSession.id)))).data, null);

  assert.equal((await read(await diaryRoute.DELETE(jsonRequest(`/api/diaries/${saved.id}`, "DELETE", undefined, cookie), context(saved.id)))).data.ok, true);
  assert.equal((await read(await communityRoute.GET(jsonRequest("/api/community", "GET")))).data.items.length, 0);
  assert.equal((await read(await logoutRoute.POST(jsonRequest("/api/auth/logout", "POST", {}, cookie)))).data.ok, true);
  assert.equal((await read(await meRoute.GET(jsonRequest("/api/me", "GET", undefined, cookie)))).data, null);
});
