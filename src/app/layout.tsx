import type { Metadata } from "next";
import "@/styles/index.css";

export const metadata: Metadata = {
  title: "Meloday",
  description: "有人听你说，也有音乐陪你走一段",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="app-html" suppressHydrationWarning>
      <body className="app-body">{children}</body>
    </html>
  );
}
