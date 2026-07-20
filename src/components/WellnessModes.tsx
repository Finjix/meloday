"use client";

import {
  ChevronLeft,
  Footprints,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  useAmbientSound,
  type AmbientSoundKind,
} from "@/lib/use-ambient-sound";

type SessionStatus = "idle" | "running" | "paused" | "complete";

const meditationSeconds = 3 * 60;
const waveBars = [14, 23, 17, 31, 20, 38, 25, 34, 19, 29, 16, 24];

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return String(minutes).padStart(2, "0") + ":" + String(rest).padStart(2, "0");
}

function useTimedSession(total: number) {
  const [session, setSession] = useState<{
    status: SessionStatus;
    elapsed: number;
  }>({ status: "idle", elapsed: 0 });

  useEffect(() => {
    if (session.status !== "running") return;
    const timer = window.setInterval(() => {
      setSession((current) => {
        if (current.status !== "running") return current;
        const elapsed = Math.min(total, current.elapsed + 1);
        return {
          elapsed,
          status: elapsed >= total ? "complete" : "running",
        };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session.status, total]);

  function toggle() {
    setSession((current) => {
      if (current.status === "complete") {
        return { status: "running", elapsed: 0 };
      }
      return {
        ...current,
        status: current.status === "running" ? "paused" : "running",
      };
    });
  }

  function reset() {
    setSession({ status: "idle", elapsed: 0 });
  }

  return {
    status: session.status,
    elapsed: session.elapsed,
    remaining: Math.max(0, total - session.elapsed),
    progress: Math.min(100, (session.elapsed / total) * 100),
    toggle,
    reset,
  };
}

function useOpenSession() {
  const [session, setSession] = useState<{
    status: SessionStatus;
    elapsed: number;
  }>({ status: "idle", elapsed: 0 });

  useEffect(() => {
    if (session.status !== "running") return;
    const timer = window.setInterval(() => {
      setSession((current) =>
        current.status === "running"
          ? { ...current, elapsed: current.elapsed + 1 }
          : current,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session.status]);

  function toggle() {
    setSession((current) => {
      if (current.status === "complete") {
        return { status: "running", elapsed: 0 };
      }
      return {
        ...current,
        status: current.status === "running" ? "paused" : "running",
      };
    });
  }

  function finish() {
    setSession((current) => ({ ...current, status: "complete" }));
  }

  function reset() {
    setSession({ status: "idle", elapsed: 0 });
  }

  return {
    status: session.status,
    elapsed: session.elapsed,
    toggle,
    finish,
    reset,
  };
}

function ModeHeader({ title, goBack }: { title: string; goBack: () => void }) {
  return (
    <header className="wellness-header">
      <button type="button" onClick={goBack} aria-label="返回首页">
        <ChevronLeft size={20} />
      </button>
      <h1>{title}</h1>
      <span aria-hidden="true" />
    </header>
  );
}

function SoundPresence({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="wellness-sound">
      <Music2 size={17} aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>{active ? "正在播放" : "准备就绪"}</span>
      </div>
      <div className={"wellness-sound__wave" + (active ? " is-playing" : "")} aria-hidden="true">
        {waveBars.map((height, index) => (
          <i key={height + "-" + index} style={{ height, animationDelay: index * 80 + "ms" }} />
        ))}
      </div>
    </div>
  );
}

export function MeditationModeView({ goBack }: { goBack: () => void }) {
  const session = useTimedSession(meditationSeconds);
  const { start: startSound, stop: stopSound } = useAmbientSound();

  useEffect(() => {
    if (session.status === "complete") stopSound(1600);
  }, [session.status, stopSound]);

  function toggleMeditation() {
    if (session.status === "running") {
      stopSound();
    } else {
      void startSound("meditation");
    }
    session.toggle();
  }

  function resetMeditation() {
    stopSound(180);
    session.reset();
  }
  const breathSecond = session.elapsed % 10;
  const breathLabel =
    session.status === "complete"
      ? "完成"
      : session.status === "paused"
        ? "暂停中"
        : session.status === "idle"
          ? "自然呼吸"
          : breathSecond < 4
            ? "吸气"
            : "呼气";
  const breathDetail =
    session.status === "running"
      ? breathSecond < 4
        ? "慢慢吸气 · 4 秒"
        : "轻轻呼气 · 6 秒"
      : session.status === "complete"
        ? "让呼吸回到自己的节奏"
        : "先找到一个舒服的姿势";
  const breathIsActive = session.status === "running" || session.status === "paused";

  return (
    <>
      <ModeHeader title="三分钟冥想" goBack={goBack} />
      <section className="meditation-page">
        <div className="meditation-page__intro">
          <h2>三分钟，只照看呼吸。</h2>
          <p>坐舒服一点，剩下的交给这一呼一吸。</p>
        </div>

        <div className="meditation-stage">
          <div className="meditation-ambient meditation-ambient--one" aria-hidden="true" />
          <div className="meditation-ambient meditation-ambient--two" aria-hidden="true" />
          <div
            className={"meditation-breath" + (breathIsActive ? " is-active" : "") + (session.status === "paused" ? " is-paused" : "")}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </div>
          <div className="meditation-stage__copy" aria-live="polite">
            <Sparkles size={17} aria-hidden="true" />
            <strong>{breathLabel}</strong>
            <span>{breathDetail}</span>
          </div>
          <time>{formatTimer(session.remaining)}</time>
        </div>

        <div className="wellness-progress" aria-label={"冥想进度 " + Math.round(session.progress) + "%"}>
          <i style={{ width: session.progress + "%" }} />
        </div>

        <SoundPresence active={session.status === "running"} label="安静钢琴与远处水声" />

        <div className="wellness-controls">
          <button type="button" className="wellness-controls__primary" onClick={toggleMeditation}>
            {session.status === "running" ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            {session.status === "idle"
              ? "开始三分钟"
              : session.status === "running"
                ? "暂停"
                : session.status === "complete"
                  ? "再来一次"
                  : "继续"}
          </button>
          {session.status !== "idle" ? (
            <button type="button" className="wellness-controls__secondary" onClick={resetMeditation} aria-label="重新开始">
              <RotateCcw size={18} />
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}

export function MovementModeView({ goBack }: { goBack: () => void }) {
  const session = useOpenSession();
  const { start: startSound, stop: stopSound } = useAmbientSound();

  function toggleMovement() {
    if (session.status === "running") {
      stopSound();
    } else {
      void startSound("movement");
    }
    session.toggle();
  }

  function finishMovement() {
    stopSound(650);
    session.finish();
  }

  function resetMovement() {
    stopSound(180);
    session.reset();
  }
  const statusLabel = session.status === "complete"
    ? "已结束"
    : session.status === "paused"
      ? "已暂停"
      : session.status === "idle"
        ? "准备好了"
        : "计时中";
  const statusDetail = session.status === "complete"
    ? "这一次，身体活动了 " + formatTimer(session.elapsed)
    : session.status === "paused"
      ? "想继续就继续，觉得够了就结束"
      : session.status === "idle"
        ? "先活动一下肩颈，找到舒服的节奏"
        : "跟着声音走，保持能自然说话的强度";

  return (
    <>
      <ModeHeader title="身体唤醒" goBack={goBack} />
      <section className="movement-page">
        <header className="movement-page__intro">
          <p className="movement-page__kicker">跟着身体走</p>
          <h2>动一动，<br />让身体慢慢醒来。</h2>
          <p className="movement-page__description">从轻一点开始，觉得刚好时就停下。</p>
        </header>

        <div className="movement-stage">
          <div className={"movement-orbit" + (session.status === "running" ? " is-moving" : "")} aria-hidden="true">
            <i className="movement-orbit__one" />
            <i className="movement-orbit__two" />
            <span><Footprints size={28} /></span>
          </div>
          <div className="movement-stage__copy" aria-live="polite">
            <span>{statusLabel}</span>
            <strong>{formatTimer(session.elapsed)}</strong>
            <small>{statusDetail}</small>
          </div>
        </div>

        <SoundPresence active={session.status === "running"} label="陪你活动的轻快声音" />

        <div className="wellness-controls wellness-controls--movement">
          <button type="button" className="wellness-controls__primary" onClick={toggleMovement}>
            {session.status === "running" ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            {session.status === "idle"
              ? "开始"
              : session.status === "running"
                ? "暂停"
                : session.status === "complete"
                  ? "再来一次"
                  : "继续"}
          </button>
          {session.status === "running" || session.status === "paused" ? (
            <button type="button" className="wellness-controls__finish" onClick={finishMovement}>
              <Square size={15} fill="currentColor" />
              结束
            </button>
          ) : null}
          {session.status === "complete" ? (
            <button type="button" className="wellness-controls__secondary" onClick={resetMovement} aria-label="重新开始">
              <RotateCcw size={18} />
            </button>
          ) : null}
        </div>
        <p className="movement-page__note">在安全的空间里活动，保持自己舒服的强度。</p>
      </section>
    </>
  );
}


const restDurations = [20, 45, 90] as const;
const restSounds = ["细雨落窗", "远处海浪", "柔和钢琴"] as const;
const restSoundKinds = {
  "细雨落窗": "rain",
  "远处海浪": "ocean",
  "柔和钢琴": "piano",
} satisfies Record<(typeof restSounds)[number], AmbientSoundKind>;

export function RestModeView({ goBack }: { goBack: () => void }) {
  const [minutes, setMinutes] = useState<(typeof restDurations)[number]>(20);
  const [sound, setSound] = useState<(typeof restSounds)[number]>("细雨落窗");
  const [fadeOut, setFadeOut] = useState(true);
  const session = useTimedSession(minutes * 60);
  const { start: startSound, stop: stopSound, setLevel: setSoundLevel } = useAmbientSound();

  function chooseDuration(next: (typeof restDurations)[number]) {
    stopSound(180);
    session.reset();
    setMinutes(next);
  }

  function chooseSound(next: (typeof restSounds)[number]) {
    setSound(next);
    if (session.status === "running") {
      void startSound(restSoundKinds[next]);
    }
  }

  function toggleRest() {
    if (session.status === "running") {
      stopSound();
    } else {
      void startSound(restSoundKinds[sound]);
    }
    session.toggle();
  }

  function resetRest() {
    stopSound(180);
    session.reset();
  }

  useEffect(() => {
    if (session.status === "complete") {
      stopSound(fadeOut ? 1800 : 250);
      return;
    }
    if (session.status !== "running") return;

    const fadeWindow = 180;
    const level =
      fadeOut && session.remaining <= fadeWindow
        ? Math.max(0.03, session.remaining / fadeWindow)
        : 1;
    setSoundLevel(level);
  }, [fadeOut, session.remaining, session.status, setSoundLevel, stopSound]);

  const statusLabel = session.status === "complete"
    ? "休息好了"
    : session.status === "running"
      ? "慢慢放松"
      : session.status === "paused"
        ? "暂停中"
        : "准备休息";

  return (
    <>
      <ModeHeader title="休息一会儿" goBack={goBack} />
      <section className="rest-page">
        <header className="rest-page__intro">
          <p>什么时候都可以</p>
          <h2>让这一会儿，慢一点。</h2>
          <span>闭上眼也好，什么都不做也好。</span>
        </header>

        <div className="rest-duration" aria-label="选择休息时长">
          {restDurations.map((item) => (
            <button
              key={item}
              type="button"
              className={minutes === item ? "is-selected" : ""}
              onClick={() => chooseDuration(item)}
              aria-pressed={minutes === item}
            >
              <strong>{item}</strong>
              <span>分钟</span>
            </button>
          ))}
        </div>

        <div className={"rest-stage" + (session.status === "running" ? " is-resting" : "")}>
          <div className="rest-stage__glow" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="rest-stage__copy" aria-live="polite">
            <span>{statusLabel}</span>
            <time>{formatTimer(session.remaining)}</time>
            <p>
              {session.status === "complete"
                ? "慢慢睁开眼，回到此刻。"
                : "不用努力睡着，只需要让身体松下来。"}
            </p>
          </div>
        </div>

        <div className="wellness-progress rest-progress" aria-label={"休息进度 " + Math.round(session.progress) + "%"}>
          <i style={{ width: session.progress + "%" }} />
        </div>

        <div className="rest-sound-row">
          <div>
            <Music2 size={18} />
            <span>陪你休息的声音</span>
          </div>
          <div className="rest-sound-options" role="group" aria-label="选择声音">
            {restSounds.map((item) => (
              <button
                key={item}
                type="button"
                className={sound === item ? "is-selected" : ""}
                onClick={() => chooseSound(item)}
                aria-pressed={sound === item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="rest-fade"
          role="switch"
          aria-checked={fadeOut}
          onClick={() => setFadeOut((value) => !value)}
        >
          <span>
            <strong>结束前渐弱</strong>
            <small>声音会在最后几分钟慢慢淡出</small>
          </span>
          <i className={fadeOut ? "is-on" : ""} aria-hidden="true" />
        </button>

        <div className="wellness-controls rest-controls">
          <button type="button" className="wellness-controls__primary" onClick={toggleRest}>
            {session.status === "running"
              ? <Pause size={18} fill="currentColor" />
              : <Play size={18} fill="currentColor" />}
            {session.status === "idle"
              ? "开始休息"
              : session.status === "running"
                ? "暂停"
                : session.status === "complete"
                  ? "再休息一次"
                  : "继续"}
          </button>
          {session.status !== "idle" ? (
            <button type="button" className="wellness-controls__secondary" onClick={resetRest} aria-label="重新开始">
              <RotateCcw size={18} />
            </button>
          ) : null}
        </div>
        <p className="rest-page__note">当前声音：{sound}{fadeOut ? " · 结束前渐弱" : ""}</p>
      </section>
    </>
  );
}

