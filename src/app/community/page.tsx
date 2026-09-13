import { AppShell } from "@/components/AppShell";
import { Community } from "@/components/Community";

export default function CommunityPage() {
  return <AppShell title="社区" requireAuth={false}><Community /></AppShell>;
}
