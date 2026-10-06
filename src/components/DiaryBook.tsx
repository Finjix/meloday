"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch, formatDate, mediaUrl } from "@/lib/client";
import type { DiaryEntry } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { DiaryDialog } from "./DiaryDialog";
import { EmptyState } from "./EmptyState";

function localDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DiaryBook() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<DiaryEntry | null>(null);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => localDate(new Date().toISOString()).slice(0, 7));
  const [mood, setMood] = useState("");
  const [style, setStyle] = useState("");
  const [reviewMonth, setReviewMonth] = useState("");
  const [trackIndex, setTrackIndex] = useState(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextOpen = useRef(false);

  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); longPressTimer.current = null; };
  const startLongPress = (entry: DiaryEntry) => {
    cancelLongPress();
    longPressTimer.current = setTimeout(() => { suppressNextOpen.current = true; setDeleteEntry(entry); longPressTimer.current = null; }, 650);
  };
  const load = async () => {
    try { const result = await apiFetch<{ entries: DiaryEntry[] }>("/api/diaries"); setEntries(result.entries); if (result.entries[0]) setCalendarMonth(localDate(result.entries[0].createdAt).slice(0, 7)); }
    catch (err) { setError(err instanceof Error ? err.message : "日记本暂时打不开。"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); return cancelLongPress; }, []);

  const updateEntry = (updated: DiaryEntry) => {
    setEntries((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    setSelectedEntry((current) => current?.id === updated.id ? updated : current);
  };
  const togglePublish = async (entry: DiaryEntry) => {
    setBusyEntryId(entry.id); setError("");
    try { updateEntry(await apiFetch<DiaryEntry>(`/api/diaries/${entry.id}/${entry.publishedAt ? "unpublish" : "publish"}`, { method: "POST" })); }
    catch (err) { setError(err instanceof Error ? err.message : "分享状态更新失败。"); }
    finally { setBusyEntryId(null); }
  };
  const remove = async () => {
    if (!deleteEntry) return;
    setBusyEntryId(deleteEntry.id); setError("");
    try { await apiFetch(`/api/diaries/${deleteEntry.id}`, { method: "DELETE" }); setEntries((current) => current.filter((entry) => entry.id !== deleteEntry.id)); setDeleteEntry(null); }
    catch (err) { setError(err instanceof Error ? err.message : "删除失败。"); setDeleteEntry(null); }
    finally { setBusyEntryId(null); }
  };

  if (loading) return <div className="page-scroll loading-panel"><span className="loading-orbit" />正在翻开日记本…</div>;

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const moods = [...new Set(entries.map((entry) => entry.musicDirection.mood).filter(Boolean))];
  const styles = [...new Set(entries.map((entry) => entry.musicDirection.style).filter(Boolean))];
  const filtered = entries.filter((entry) =>
    (!normalizedQuery || [entry.title, entry.summary, entry.body].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))) &&
    (!date || localDate(entry.createdAt) === date) &&
    (!mood || entry.musicDirection.mood === mood) &&
    (!style || entry.musicDirection.style === style));
  const today = localDate(new Date().toISOString());
  const onThisDay = entries.filter((entry) => localDate(entry.createdAt).slice(5) === today.slice(5) && localDate(entry.createdAt).slice(0, 4) !== today.slice(0, 4));
  const months = [...new Set(entries.map((entry) => localDate(entry.createdAt).slice(0, 7)))];
  const selectedMonth = reviewMonth || months[0] || today.slice(0, 7);
  const monthly = entries.filter((entry) => localDate(entry.createdAt).startsWith(selectedMonth));
  const playlist = monthly.filter((entry) => entry.audioAssetId);
  const activeTrack = playlist[Math.min(trackIndex, playlist.length - 1)];
  const dominantMood = [...new Set(monthly.map((entry) => entry.musicDirection.mood))]
    .sort((a, b) => monthly.filter((entry) => entry.musicDirection.mood === b).length - monthly.filter((entry) => entry.musicDirection.mood === a).length)[0];
  const [calendarYear, calendarMonthNumber] = calendarMonth.split("-").map(Number);
  const firstWeekday = (new Date(calendarYear, calendarMonthNumber - 1, 1).getDay() + 6) % 7;
  const calendarDayCount = new Date(calendarYear, calendarMonthNumber, 0).getDate();
  const calendarDates = Array.from({ length: firstWeekday + calendarDayCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 ? `${calendarMonth}-${String(day).padStart(2, "0")}` : null;
  });
  const diaryDates = new Set(entries.map((entry) => localDate(entry.createdAt)));
  const shiftCalendar = (months: number) => {
    const next = new Date(calendarYear, calendarMonthNumber - 1 + months, 1);
    setCalendarMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  return <div className="page-scroll diary-book-page">
    <div className="page-intro"><div><span className="eyebrow">保存下来的日子</span><h1>日记本</h1><p>每一页，都是今天曾经认真生活过的证据。</p></div></div>
    {error && <div className="notice" role="alert">{error}</div>}
    {entries.length === 0 ? <EmptyState title="这里还很安静" text="完成第一张音乐日记卡片，它就会出现在这里。" action={<Link href="/" className="button button-primary">写下今天 →</Link>} /> : <>
      {onThisDay.length > 0 && <section className="diary-review-panel"><span className="eyebrow">往年今日</span><h2>这一日，你曾留下</h2><div className="diary-review-links">{onThisDay.map((entry) => <Link href={`/diary/${entry.id}`} key={entry.id}>{entry.title}<span>{localDate(entry.createdAt).slice(0, 4)}</span></Link>)}</div></section>}
      <section className="diary-filter-panel" aria-label="查找日记">
        <label className="diary-search-label">搜索文字<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="找一段故事、一个标题…" /></label>
        <div className="diary-calendar" aria-label="按日历查找日记">
          <div className="diary-calendar-heading"><strong>{calendarYear} 年 {calendarMonthNumber} 月</strong><div><button type="button" onClick={() => shiftCalendar(-1)} aria-label="上个月">←</button><button type="button" onClick={() => shiftCalendar(1)} aria-label="下个月">→</button></div></div>
          <div className="diary-calendar-grid">{["一", "二", "三", "四", "五", "六", "日"].map((weekday) => <span key={weekday} className="diary-calendar-weekday">{weekday}</span>)}{calendarDates.map((value, index) => value ? <button key={value} type="button" className={diaryDates.has(value) ? "has-diary" : ""} aria-label={`${value}${diaryDates.has(value) ? "，有日记" : ""}`} aria-pressed={date === value} onClick={() => setDate((current) => current === value ? "" : value)}>{Number(value.slice(-2))}</button> : <span key={`blank-${index}`} />)}</div>
          <small>有标记的日期写过日记；再点一次可取消选择。</small>
        </div>
        <div className="diary-filter-grid">
          <label>选择日期<input type="date" value={date} onChange={(event) => { setDate(event.target.value); if (event.target.value) setCalendarMonth(event.target.value.slice(0, 7)); }} /></label>
          <label>心情<select value={mood} onChange={(event) => setMood(event.target.value)}><option value="">全部心情</option>{moods.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>曲风<select value={style} onChange={(event) => setStyle(event.target.value)}><option value="">全部曲风</option>{styles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
        {(query || date || mood || style) && <button className="diary-clear-filters" type="button" onClick={() => { setQuery(""); setDate(""); setMood(""); setStyle(""); }}>清除筛选</button>}
      </section>
      {filtered.length === 0 ? <div className="diary-no-results">没有找到相符的日记。换个词或日期试试。</div> : <div className="diary-list">{filtered.map((entry) => {
        const cover = mediaUrl(entry.coverAssetId);
        return <article className="diary-list-card" key={entry.id} role="link" tabIndex={0}
          onPointerDown={(event) => { if (event.isPrimary && !(event.target instanceof Element && event.target.closest(".diary-list-actions"))) startLongPress(entry); }}
          onPointerUp={cancelLongPress} onPointerCancel={cancelLongPress} onPointerLeave={cancelLongPress}
          onClick={(event) => { if (event.target instanceof Element && event.target.closest(".diary-list-actions")) return; if (suppressNextOpen.current) { suppressNextOpen.current = false; return; } setSelectedEntry(entry); }}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedEntry(entry); } }}>
          {cover ? <div className="diary-list-cover"><Image src={cover} alt="日记封面" fill sizes="(max-width: 700px) 92px, 132px" unoptimized /></div> : <div className="diary-list-cover"><span>♫</span></div>}
          <div className="diary-list-copy"><div className="diary-list-meta"><span className="eyebrow">{formatDate(entry.createdAt)}</span>{entry.publishedAt && <span className="eyebrow diary-published">分享中</span>}</div><h2>{entry.title}</h2><p>{entry.summary}</p></div>
        </article>;
      })}</div>}
      <section className="diary-review-panel" aria-label="月度回顾与歌单">
        <div className="diary-section-heading"><div><span className="eyebrow">回听日子</span><h2>月度回顾</h2></div><label className="diary-month-select">月份<select value={selectedMonth} onChange={(event) => { setReviewMonth(event.target.value); setTrackIndex(0); }}>{months.map((month) => <option value={month} key={month}>{month}</option>)}</select></label></div>
        <p>{selectedMonth.replace("-", " 年 ")} 月，你留下了 {monthly.length} 篇音乐日记{dominantMood ? `，最常出现的心情是「${dominantMood}」` : ""}。</p>
        {activeTrack && <div className="diary-playlist"><div className="diary-section-heading"><h3>这个月的歌单 · {playlist.length} 首</h3><span>{trackIndex + 1} / {playlist.length}</span></div><p>正在播放：<Link href={`/diary/${activeTrack.id}`}>{activeTrack.title}</Link></p><audio key={activeTrack.id} controls src={mediaUrl(activeTrack.audioAssetId)!} onEnded={() => setTrackIndex((current) => current + 1 < playlist.length ? current + 1 : 0)} /><div className="diary-track-list">{playlist.map((entry, index) => <button key={entry.id} type="button" aria-current={trackIndex === index ? "true" : undefined} onClick={() => setTrackIndex(index)}>{String(index + 1).padStart(2, "0")} · {entry.title}</button>)}</div></div>}
      </section>
    </>}
    {selectedEntry && <DiaryDialog entry={selectedEntry} onClose={() => setSelectedEntry(null)} onTogglePublish={() => void togglePublish(selectedEntry)} busy={busyEntryId === selectedEntry.id} />}
    <ConfirmDialog open={Boolean(deleteEntry)} title="确定删除这一页吗？" description="" confirmLabel="删除这一页" busy={busyEntryId === deleteEntry?.id} onCancel={() => setDeleteEntry(null)} onConfirm={() => void remove()} />
  </div>;
}
