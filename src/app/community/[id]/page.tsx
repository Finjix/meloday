import { AppShell } from "@/components/AppShell";
import { SharedDiaryDetail } from "@/components/SharedDiaryDetail";

export default async function SharedDiaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell title="分享" requireAuth={false}><SharedDiaryDetail id={id} /></AppShell>;
}
