import { AppShell } from "@/components/AppShell";
import { DiaryDetail } from "@/components/DiaryDetail";

export default async function DiaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell title="这一页"><DiaryDetail id={id} /></AppShell>;
}
