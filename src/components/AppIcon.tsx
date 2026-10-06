import type { ReactNode } from "react";

type IconName = "rest" | "energy" | "today" | "diary" | "community" | "profile" | "photo" | "mic" | "newDiary" | "send";

const paths = {
  rest: <><path d="M20.2 15.3A8.6 8.6 0 0 1 8.7 3.8 8.7 8.7 0 1 0 20.2 15.3Z" /><path d="M17.8 4.2v3.6M16 6h3.6" /></>,
  energy: <><path d="M9 16.8V7.1L17 5v9.5" /><path d="M9 9.6 17 7.5" /><ellipse cx="6.5" cy="17.5" rx="2.5" ry="1.8" transform="rotate(-20 6.5 17.5)" fill="currentColor" stroke="none" /><ellipse cx="14.5" cy="15.2" rx="2.5" ry="1.8" transform="rotate(-20 14.5 15.2)" fill="currentColor" stroke="none" /><path d="M20.2 8.1h2M19.7 4.7l1.3-1.3M20 11.5l1.5 1" /></>,
  today: <><path d="M12 2.8c.7 5.2 2 6.5 7.2 7.2-5.2.7-6.5 2-7.2 7.2-.7-5.2-2-6.5-7.2-7.2 5.2-.7 6.5-2 7.2-7.2Z" /><path d="M19.4 16.5c.25 1.45.65 1.85 2.1 2.1-1.45.25-1.85.65-2.1 2.1-.25-1.45-.65-1.85-2.1-2.1 1.45-.25 1.85-.65 2.1-2.1Z" /></>,
  diary: <><path d="M12 5.8C9.5 4.5 6.5 4.1 3.5 4.6v13.2c3-.5 6 0 8.5 1.3 2.5-1.3 5.5-1.8 8.5-1.3V4.6c-3-.5-6 .0-8.5 1.2Z" /><path d="M12 5.8v13.3M6.5 8.8c1.1 0 2.1.2 3.1.6M14.4 9.4c1-.4 2-.6 3.1-.6" /></>,
  community: <><path d="M20 11.4c0 4.1-3.6 7.4-8 7.4-1.1 0-2.2-.2-3.2-.6L4 20l1.2-4C4.4 14.8 4 13.2 4 11.4 4 7.3 7.6 4 12 4s8 3.3 8 7.4Z" /><path d="M8.6 11.5h6.8M8.6 14.2h4.4" /></>,
  profile: <><circle cx="12" cy="8.4" r="3.3" /><path d="M5.2 19.3c.5-3.4 3-5.3 6.8-5.3s6.3 1.9 6.8 5.3" /></>,
  photo: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.2" cy="9" r="1.4" /><path d="m4.5 17 4.7-4.4 3.1 2.7 2.5-2.1 4.7 3.8" /></>,
  mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21m-3.5 0h7" /></>,
  newDiary: <><path d="M6 3.5h8l4 4V20H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5v4h4M8 13h6m-3-3v6" /></>,
  send: <><path d="M21 3 3.8 10.2a1 1 0 0 0 .1 1.9l6.5 1.5 1.5 6.5a1 1 0 0 0 1.9.1L21 3Z" /><path d="m10.4 13.6 4.5-4.5" /></>,
} satisfies Record<IconName, ReactNode>;

export function AppIcon({ name, className }: { name: IconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export function WelcomeMark() {
  return <svg viewBox="0 0 96 96" fill="none" aria-hidden="true" focusable="false">
    <path d="M12 25c13-4 25-3 36 4 11-7 23-8 36-4v49c-13-4-25-3-36 4-11-7-23-8-36-4V25Z" fill="#fffaf1" stroke="#749687" strokeWidth="3" strokeLinejoin="round" />
    <path d="M48 29v49" stroke="#749687" strokeWidth="3" strokeLinecap="round" />
    <path d="M24 39c6-1 11-.5 16 1.5M24 48c6-1 11-.5 16 1.5M24 57c6-1 11-.5 16 1.5" stroke="#b6c9ba" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M59 54V38l14-3v16" stroke="#c78360" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <ellipse cx="55" cy="56" rx="4" ry="3" transform="rotate(-24 55 56)" fill="#c78360" />
    <ellipse cx="69" cy="53" rx="4" ry="3" transform="rotate(-24 69 53)" fill="#c78360" />
  </svg>;
}
