"use client";

import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Headphones,
  Info,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { CoverArt } from "@/components/CoverArt";
import { createMelodayArchive, restoreMelodayArchive } from "@/lib/backup";
import type { ServiceAvailability } from "@/lib/client-api";
import {
  addCompanionMemory,
  deleteCompanionMemory,
  loadCompanionMemories,
  setCompanionMemoryUsage,
} from "@/lib/memories";
import { getMediaBlob } from "@/lib/storage";
import type { CompanionMemory, CompanionPreferences, DiaryEntry } from "@/lib/types";

type MinePanel = "main" | "preferences" | "memories" | "data" | "services" | "about";

type MineViewProps = {
  entries: DiaryEntry[];
  preferences: CompanionPreferences;
  updatePreferences: (next: CompanionPreferences) => void;
  openEntry: (id: string) => void;
  clearEntries: () => Promise<void>;
  archiveImported: () => void;
  initialPanel?: "services";
  serviceAvailability: ServiceAvailability | null;
  servicesChanged: () => Promise<void>;
};

type ApiSettings = {
  deepseekApiKey: string;
  minimaxApiKey: string;
};

const apiSettingsStorageKey = "meloday.api-settings.v1";

const replyOptions = [
  { value: "gentle", label: "温柔一点", detail: "先接住感受，再慢慢回应" },
  { value: "concise", label: "少说一点", detail: "简短、自然，不打断情绪" },
  { value: "direct", label: "直接一点", detail: "坦率清楚，也保留温度" },
] as const;

const soundOptions = [
  { value: "warm", label: "温暖", detail: "轻钢琴与柔和氛围" },
  { value: "clear", label: "清透", detail: "轻盈、留白、较少低频" },
  { value: "deep", label: "低沉", detail: "克制、安静、缓慢铺陈" },
] as const;

const soundBars = [18, 31, 46, 27, 58, 38, 24, 51, 33, 42, 21];

function formatEntryDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(new Date(date + "T00:00:00+08:00"));
}

function loadApiSettings(): ApiSettings {
  if (typeof window === "undefined") {
    return { deepseekApiKey: "", minimaxApiKey: "" };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(apiSettingsStorageKey) || "{}");
    return {
      deepseekApiKey:
        typeof parsed.deepseekApiKey === "string" ? parsed.deepseekApiKey : "",
      minimaxApiKey:
        typeof parsed.minimaxApiKey === "string" ? parsed.minimaxApiKey : "",
    };
  } catch {
    return { deepseekApiKey: "", minimaxApiKey: "" };
  }
}

function useMineEntryMedia(entry?: DiaryEntry) {
  const [audioUrl, setAudioUrl] = useState<string>();
  const [coverUrl, setCoverUrl] = useState<string>();

  useEffect(() => {
    let disposed = false;
    let nextAudioUrl: string | undefined;
    let nextCoverUrl: string | undefined;

    async function loadMedia() {
      if (!entry) return;
      const [audioBlob, coverBlob] = await Promise.all([
        getMediaBlob(entry.audioBlobId),
        getMediaBlob(entry.coverBlobId),
      ]);
      if (disposed) return;

      nextAudioUrl = audioBlob ? URL.createObjectURL(audioBlob) : undefined;
      nextCoverUrl = coverBlob ? URL.createObjectURL(coverBlob) : undefined;
      setAudioUrl(nextAudioUrl);
      setCoverUrl(nextCoverUrl);
    }

    void loadMedia();

    return () => {
      disposed = true;
      if (nextAudioUrl) URL.revokeObjectURL(nextAudioUrl);
      if (nextCoverUrl) URL.revokeObjectURL(nextCoverUrl);
    };
  }, [entry]);

  return { audioUrl, coverUrl };
}

function MineSubHeader({
  title,
  goBack,
}: {
  title: string;
  goBack: () => void;
}) {
  return (
    <header className="mine-subheader">
      <button type="button" onClick={goBack} aria-label="返回声音档案">
        <ChevronLeft size={20} />
      </button>
      <h1>{title}</h1>
      <span aria-hidden="true" />
    </header>
  );
}

function MineMenuRow({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="mine-menu-row">
      <span className="mine-menu-row__icon" aria-hidden="true">{icon}</span>
      <span className="mine-menu-row__copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <ChevronRight size={17} aria-hidden="true" />
    </button>
  );
}

function MineRecentEntry({
  entry,
  openEntry,
}: {
  entry: DiaryEntry;
  openEntry: (id: string) => void;
}) {
  const { audioUrl, coverUrl } = useMineEntryMedia(entry);

  return (
    <article className="mine-recent">
      <button
        type="button"
        onClick={() => openEntry(entry.id)}
        className="mine-recent__summary"
      >
        <div className="mine-recent__cover">
          <CoverArt title={entry.title} coverUrl={coverUrl} compact />
        </div>
        <div className="mine-recent__copy">
          <time>{formatEntryDate(entry.date)}</time>
          <h3>{entry.title}</h3>
          <p>{entry.summary}</p>
          <span>打开这段声音 <ChevronRight size={14} /></span>
        </div>
      </button>
      {entry.audioBlobId ? (
        <div className="mine-recent__player">
          <AudioPlayer
            src={audioUrl}
            label={entry.title}
            persistenceKey={entry.id}
            artworkUrl={coverUrl}
          />
        </div>
      ) : null}
    </article>
  );
}

function PreferenceOption({
  active,
  label,
  detail,
  onClick,
}: {
  active: boolean;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={"mine-choice" + (active ? " mine-choice--active" : "")}
      aria-pressed={active}
    >
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <i aria-hidden="true" />
    </button>
  );
}

function MinePreferencesPanel({
  preferences,
  updatePreferences,
  goBack,
}: {
  preferences: CompanionPreferences;
  updatePreferences: (next: CompanionPreferences) => void;
  goBack: () => void;
}) {
  return (
    <>
      <MineSubHeader title="陪伴方式" goBack={goBack} />
      <section className="mine-panel-page">
        <header className="mine-panel-intro">
          <span>只保存在这台设备</span>
          <h2>让每一次回应，更像你熟悉的方式。</h2>
        </header>

        <div className="mine-field">
          <label htmlFor="mine-nickname">希望怎么称呼你</label>
          <input
            id="mine-nickname"
            value={preferences.nickname}
            onChange={(event) =>
              updatePreferences({ ...preferences, nickname: event.target.value.slice(0, 12) })
            }
            maxLength={12}
            placeholder="不填写也可以"
          />
        </div>

        <fieldset className="mine-choice-group">
          <legend>回应的感觉</legend>
          {replyOptions.map((option) => (
            <PreferenceOption
              key={option.value}
              active={preferences.replyStyle === option.value}
              label={option.label}
              detail={option.detail}
              onClick={() =>
                updatePreferences({ ...preferences, replyStyle: option.value })
              }
            />
          ))}
        </fieldset>

        <fieldset className="mine-choice-group">
          <legend>声音的气质</legend>
          {soundOptions.map((option) => (
            <PreferenceOption
              key={option.value}
              active={preferences.soundStyle === option.value}
              label={option.label}
              detail={option.detail}
              onClick={() =>
                updatePreferences({ ...preferences, soundStyle: option.value })
              }
            />
          ))}
        </fieldset>

        <div className="mine-toggle-row">
          <span>
            <strong>打开单篇日记时自动播放</strong>
            <small>浏览日记列表时不会自动播放</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.autoPlayEntry}
            aria-label="打开单篇日记时自动播放"
            onClick={() =>
              updatePreferences({
                ...preferences,
                autoPlayEntry: !preferences.autoPlayEntry,
              })
            }
            className={"mine-switch" + (preferences.autoPlayEntry ? " mine-switch--active" : "")}
          >
            <i />
          </button>
        </div>
      </section>
    </>
  );
}

function MineDataPanel({
  entries,
  preferences,
  updatePreferences,
  clearEntries,
  archiveImported,
  goBack,
}: {
  entries: DiaryEntry[];
  preferences: CompanionPreferences;
  updatePreferences: (next: CompanionPreferences) => void;
  clearEntries: () => Promise<void>;
  archiveImported: () => void;
  goBack: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState<"export" | "import" | null>(null);
  const [notice, setNotice] = useState("");

  async function handleExport() {
    if (!entries.length || working) return;
    setWorking("export");
    setNotice("");

    try {
      const blob = await createMelodayArchive(entries, preferences);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        "meloday-complete-" + new Date().toISOString().slice(0, 10) + ".json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice("完整备份已经准备好。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "备份没有完成，请再试一次。");
    } finally {
      setWorking(null);
    }
  }

  async function handleImport(file?: File) {
    if (!file || working) return;
    setWorking("import");
    setNotice("");

    try {
      const result = await restoreMelodayArchive(file);
      updatePreferences(result.preferences);
      archiveImported();
      setNotice(
        result.restoredCount
          ? "已经恢复 " + result.restoredCount + " 篇日记。"
          : "备份中没有可恢复的日记。",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法恢复这个备份。");
    } finally {
      setWorking(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <MineSubHeader title="数据与隐私" goBack={goBack} />
      <section className="mine-panel-page">
        <header className="mine-panel-intro">
          <span>你的内容属于你</span>
          <h2>日记、声音和封面保存在当前浏览器中。</h2>
          <p>完整备份包含日记、声音、封面与本地偏好，不包含服务密钥。</p>
        </header>

        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={entries.length === 0 || Boolean(working)}
          className="mine-action-row"
        >
          <Download size={18} />
          <span>
            <strong>{working === "export" ? "正在整理备份" : "导出完整备份"}</strong>
            <small>{entries.length ? "可以在这台或其他设备恢复" : "还没有可导出的日记"}</small>
          </span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={Boolean(working)}
          className="mine-action-row"
        >
          <Upload size={18} />
          <span>
            <strong>{working === "import" ? "正在恢复" : "恢复完整备份"}</strong>
            <small>选择之前导出的 Meloday 备份文件</small>
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(event) => void handleImport(event.target.files?.[0])}
        />

        {notice ? <p className="mine-data-notice" role="status">{notice}</p> : null}

        <button
          type="button"
          onClick={() => void clearEntries()}
          disabled={entries.length === 0 || Boolean(working)}
          className="mine-action-row mine-action-row--danger"
        >
          <Trash2 size={18} />
          <span>
            <strong>清除全部日记</strong>
            <small>同时删除保存在本地的封面与声音</small>
          </span>
        </button>
      </section>
    </>
  );
}

function MineMemoriesPanel({ goBack }: { goBack: () => void }) {
  const [memories, setMemories] = useState<CompanionMemory[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setMemories(loadCompanionMemories()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleMemory(memory: CompanionMemory) {
    if (!memory.useInResponses) {
      const allowed = window.confirm(
        "允许在后续回应和声音创作中使用这条内容吗？开启后，它会随对话发送给你已连接的回应服务。",
      );
      if (!allowed) return;
    }
    setMemories(setCompanionMemoryUsage(memory.id, !memory.useInResponses));
  }

  return (
    <>
      <MineSubHeader title="被记住的事" goBack={goBack} />
      <section className="mine-panel-page mine-memory-page">
        <header className="mine-panel-intro">
          <span>由你决定</span>
          <h2>希望我记住什么？</h2>
          <p>可以留下一点偏好或近况。每一条都由你决定是否用于后续回应。</p>
        </header>

        <form
          className="mine-memory-compose"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft.trim();
            if (!value) return;
            setMemories(addCompanionMemory(value));
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={100}
            placeholder="例如：我不喜欢太吵的声音"
            aria-label="希望 Meloday 记住的事"
          />
          <button type="submit" disabled={!draft.trim()}>
            <Plus size={18} />
            留下
          </button>
        </form>

        {memories.length ? (
          <div className="mine-memory-list">
            {memories.map((memory) => (
              <article className="mine-memory-row" key={memory.id}>
                <p>{memory.text}</p>
                <div className="mine-memory-row__actions">
                  <label className="mine-memory-consent">
                    <input
                      type="checkbox"
                      checked={memory.useInResponses}
                      onChange={() => toggleMemory(memory)}
                    />
                    <span aria-hidden="true"><i /></span>
                    <strong>用于回应</strong>
                  </label>
                  <button
                    type="button"
                    onClick={() => setMemories(deleteCompanionMemory(memory.id))}
                    aria-label={`删除：${memory.text}`}
                    title="删除"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <small>{memory.useInResponses ? "已允许使用" : "只保存在本机"}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="mine-memory-empty">
            <Bookmark size={24} strokeWidth={1.5} />
            <strong>还没有记住什么</strong>
            <p>想留下时，写一句就好。</p>
          </div>
        )}

        <p className="mine-memory-privacy">
          开启“用于回应”后，这条内容会随对话发送给已连接的回应服务；关闭时只保存在当前设备。
        </p>
      </section>
    </>
  );
}
function serviceStatusLabel(status?: ServiceAvailability["conversation"]) {
  if (status === "included") return "已准备好";
  if (status === "device") return "使用此设备连接";
  if (status === "missing") return "等待连接";
  return "正在确认";
}

function MineServicesPanel({
  availability,
  servicesChanged,
  goBack,
}: {
  availability: ServiceAvailability | null;
  servicesChanged: () => Promise<void>;
  goBack: () => void;
}) {
  const [settings, setSettings] = useState<ApiSettings>(() => loadApiSettings());

  const conversationStatus =
    availability?.conversation === "included"
      ? "included"
      : settings.deepseekApiKey.trim()
        ? "device"
        : availability?.conversation;
  const soundStatus =
    availability?.sound === "included"
      ? "included"
      : settings.minimaxApiKey.trim()
        ? "device"
        : availability?.sound;
  const bothReady =
    conversationStatus !== undefined &&
    soundStatus !== undefined &&
    conversationStatus !== "missing" &&
    soundStatus !== "missing";

  function updateSetting(key: keyof ApiSettings, value: string) {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem(apiSettingsStorageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <>
      <MineSubHeader title="服务连接" goBack={goBack} />
      <section className="mine-panel-page">
        <header className="mine-panel-intro">
          <span>{bothReady ? "已经准备好" : "完成一次连接"}</span>
          <h2>{bothReady ? "回应和声音，都可以使用。" : "让回应和声音都准备好。"}</h2>
          <p>Meloday 已经提供连接时，不需要填写任何内容。</p>
        </header>

        <div className="mine-service-overview" aria-label="服务连接状态">
          <div>
            <span><i aria-hidden="true" />回应与日记</span>
            <strong>{serviceStatusLabel(conversationStatus)}</strong>
          </div>
          <div>
            <span><i aria-hidden="true" />专属声音</span>
            <strong>{serviceStatusLabel(soundStatus)}</strong>
          </div>
        </div>

        <details
          className="mine-service-custom"
          open={conversationStatus === "missing" || soundStatus === "missing" ? true : undefined}
        >
          <summary>使用自己的连接</summary>
          <p>只在本地开发或自定义服务时使用，内容仅保存在当前浏览器。</p>

          <label className="mine-secret-field">
            <span>
              <strong>回应服务</strong>
              <small>{serviceStatusLabel(conversationStatus)}</small>
            </span>
            <input
              value={settings.deepseekApiKey}
              onChange={(event) => updateSetting("deepseekApiKey", event.target.value)}
              onBlur={() => void servicesChanged()}
              type="password"
              autoComplete="off"
              aria-label="回应服务密钥"
              placeholder="粘贴服务密钥"
            />
          </label>

          <label className="mine-secret-field">
            <span>
              <strong>声音服务</strong>
              <small>{serviceStatusLabel(soundStatus)}</small>
            </span>
            <input
              value={settings.minimaxApiKey}
              onChange={(event) => updateSetting("minimaxApiKey", event.target.value)}
              onBlur={() => void servicesChanged()}
              type="password"
              autoComplete="off"
              aria-label="声音服务密钥"
              placeholder="粘贴服务密钥"
            />
          </label>
        </details>
      </section>
    </>
  );
}

function MineAboutPanel({ goBack }: { goBack: () => void }) {
  return (
    <>
      <MineSubHeader title="关于 Meloday" goBack={goBack} />
      <section className="mine-panel-page mine-about">
        <div
          style={{
            width: 204,
            minHeight: 82,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "28px auto 0",
            overflow: "hidden",
          }}
        >
          <Image
            src="/brand/meloday-logo.png"
            alt="Meloday"
            width={1500}
            height={669}
            style={{ display: "block", width: 176, height: "auto" }}
          />
        </div>
        <h2>有些日子，值得被听见。</h2>
        <p>
          Meloday 陪你把没有说完的话留下来，让文字、画面和声音成为同一段记忆。
        </p>
        <div className="mine-about__note">
          <ShieldCheck size={17} />
          <span>你的个人偏好与日记索引默认保存在当前设备。</span>
        </div>
      </section>
    </>
  );
}

export function MineView({
  entries,
  preferences,
  updatePreferences,
  openEntry,
  clearEntries,
  archiveImported,
  initialPanel,
  serviceAvailability,
  servicesChanged,
}: MineViewProps) {
  const [panel, setPanel] = useState<MinePanel>(initialPanel ?? "main");
  const latestEntry = entries[0];
  const firstEntry = entries[entries.length - 1];
  const dayCount = new Set(entries.map((entry) => entry.date)).size;

  if (panel === "preferences") {
    return (
      <MinePreferencesPanel
        preferences={preferences}
        updatePreferences={updatePreferences}
        goBack={() => setPanel("main")}
      />
    );
  }
  if (panel === "memories") {
    return <MineMemoriesPanel goBack={() => setPanel("main")} />;
  }

  if (panel === "data") {
    return (
      <MineDataPanel
        entries={entries}
        preferences={preferences}
        updatePreferences={updatePreferences}
        clearEntries={clearEntries}
        archiveImported={archiveImported}
        goBack={() => setPanel("main")}
      />
    );
  }
  if (panel === "services") {
    return (
      <MineServicesPanel
        availability={serviceAvailability}
        servicesChanged={servicesChanged}
        goBack={() => setPanel("main")}
      />
    );
  }
  if (panel === "about") {
    return <MineAboutPanel goBack={() => setPanel("main")} />;
  }

  const archiveText =
    entries.length === 0
      ? "从第一次开口开始，这里会慢慢长成你的声音档案。"
      : entries.length === 1
        ? "从 " + formatEntryDate(firstEntry.date) + " 起，这里有了第一段声音。"
        : "从 " + formatEntryDate(firstEntry.date) + " 起，你已经留下 " +
          entries.length + " 段声音。";

  const replyLabel =
    replyOptions.find((option) => option.value === preferences.replyStyle)?.label ??
    "温柔一点";
  const soundLabel =
    soundOptions.find((option) => option.value === preferences.soundStyle)?.label ??
    "温暖";

  return (
    <section className="mine-page">
      <header className="mine-page__header">
        <h1>我的声音档案</h1>
        <p>有些日子，已经被好好留下。</p>
      </header>

      <article className="mine-profile">
        <div className="mine-profile__top">
          <div className="mine-soundmark" aria-hidden="true">
            {soundBars.map((height, index) => (
              <i key={height + "-" + index} style={{ height }} />
            ))}
          </div>
          <UserRound size={18} strokeWidth={1.6} aria-hidden="true" />
        </div>
        <div className="mine-profile__copy">
          <span>个人声纹</span>
          <h2>
            {preferences.nickname
              ? preferences.nickname + "的声音档案"
              : "你的声音档案"}
          </h2>
          <p>{archiveText}</p>
        </div>
        {entries.length ? (
          <div className="mine-profile__foot">
            <span>{dayCount} 个被记住的日子</span>
            <span>{entries.length} 段声音</span>
          </div>
        ) : null}
      </article>

      <section className="mine-section mine-section--recent">
        {latestEntry ? (
          <MineRecentEntry entry={latestEntry} openEntry={openEntry} />
        ) : (
          <div className="mine-empty">
            <Headphones size={23} strokeWidth={1.5} />
            <h3>这里还很安静</h3>
            <p>第一篇声音日记，会从这里再次响起。</p>
          </div>
        )}
      </section>

      <section className="mine-section">
        <div className="mine-section__heading">
          <div>
            <h2>陪伴方式</h2>
          </div>
          <button type="button" onClick={() => setPanel("preferences")}>
            调整 <ChevronRight size={15} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setPanel("preferences")}
          className="mine-preference-summary"
        >
          <span>
            <strong>{preferences.nickname || "自然称呼"}</strong>
            <small>怎么称呼你</small>
          </span>
          <i />
          <span>
            <strong>{replyLabel}</strong>
            <small>回应的感觉</small>
          </span>
          <i />
          <span>
            <strong>{soundLabel}</strong>
            <small>声音的气质</small>
          </span>
        </button>
      </section>

      <section className="mine-section mine-settings">
        <div className="mine-section__heading">
          <div>
            <h2>设置</h2>
          </div>
        </div>
        <div className="mine-menu">
          <MineMenuRow
            icon={<Bookmark size={18} />}
            title="被记住的事"
            detail="管理偏好与近况"
            onClick={() => setPanel("memories")}
          />
          <MineMenuRow
            icon={<ShieldCheck size={18} />}
            title="数据与隐私"
            detail="导出或清除本地记录"
            onClick={() => setPanel("data")}
          />
          <MineMenuRow
            icon={<KeyRound size={18} />}
            title="服务连接"
            detail="管理对话与声音服务"
            onClick={() => setPanel("services")}
          />
          <MineMenuRow
            icon={<Info size={18} />}
            title="关于 Meloday"
            detail="了解这个声音空间"
            onClick={() => setPanel("about")}
          />
        </div>
      </section>
    </section>
  );
}
