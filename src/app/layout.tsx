import type { Metadata } from "next";
import "./globals.css";
import "./diary-hub.css";
import "./experience.css";

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
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
