import type { Metadata, Viewport } from "next";
import "./styles.css";
import { AuthProvider } from "@/components/AuthContext";

export const metadata: Metadata = {
  title: "Meloday · 音乐日记",
  description: "把每一天，变成一段旋律。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><AuthProvider>{children}</AuthProvider></body></html>;
}
