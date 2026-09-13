import { getDb } from "@/server/db";

getDb().prepare("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").get();
console.log("Meloday database is ready.");
