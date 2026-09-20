import { deleteExpiredAuthSessions, deleteOldTransientSessions, markExpiredSessions } from "@/server/repositories";
import { removeOrphanedMedia } from "@/server/media";

const expired = markExpiredSessions();
const sessions = deleteOldTransientSessions();
const auth = deleteExpiredAuthSessions();
const media = await removeOrphanedMedia();
console.log(JSON.stringify({ expired, sessions, auth, media }));
