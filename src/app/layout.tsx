import type { Metadata } from "next";
import "./styles.css";
import { AuthProvider } from "@/components/AuthContext";

export const metadata: Metadata = {
  title: "Meloday · 音乐日记",
  description: "把每一天，变成一段旋律。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><AuthProvider>{children}</AuthProvider></body></html>;
}
