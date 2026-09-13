import { deleteExpiredAuthSessions, deleteOldTransientSessions, markExpiredSessions, markRunningJobsFailed } from "@/server/repositories";
import { removeOrphanedMedia } from "@/server/media";

const expired = markExpiredSessions();
const sessions = deleteOldTransientSessions();
const auth = deleteExpiredAuthSessions();
const jobs = markRunningJobsFailed();
const media = await removeOrphanedMedia();
console.log(JSON.stringify({ expired, sessions, auth, jobs, media }));
