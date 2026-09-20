import { AppShell } from "@/components/AppShell";
import { Community } from "@/components/Community";

export default function CommunityPage() {
  return <AppShell title="分享" requireAuth={false}><Community /></AppShell>;
}
