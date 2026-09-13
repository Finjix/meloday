import { getUserByUsername, grantCapacity } from "@/server/repositories";

const [username, amountText, ...reasonParts] = process.argv.slice(2);
if (!process.env.MELODAY_ADMIN_TOKEN) throw new Error("MELODAY_ADMIN_TOKEN must be configured before granting capacity.");
const amount = Number(amountText);
if (!username || !Number.isInteger(amount) || amount <= 0 || amount > 10000) throw new Error("Usage: npm run capacity:grant -- <username> <positive amount> [reason]");
const user = getUserByUsername(username);
if (!user) throw new Error(`User not found: ${username}`);
const updated = grantCapacity(user.id, amount, reasonParts.join(" ") || "manual grant");
console.log(`${updated.username} capacity: ${updated.diaryLimit}`);
