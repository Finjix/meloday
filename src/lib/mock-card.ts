import type { CardPayload, ChatMessage, CoverMeta } from "@/lib/types";

const palettes = {
  warm: {
    from: "#f7d9c4",
    via: "#f6efe5",
    to: "#b7d8cf",
    accent: "#d67b65",
  },
  calm: {
    from: "#d9e7e2",
    via: "#f7f4ef",
    to: "#a9bfd7",
    accent: "#477c8b",
  },
  bright: {
    from: "#ffe1a8",
    via: "#fff7df",
    to: "#a8d7c5",
    accent: "#d89f2f",
  },
  blue: {
    from: "#c9ddf3",
    via: "#f6f7f4",
    to: "#d6c7e8",
    accent: "#5f75b7",
  },
};

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getUserText(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join(" ");
}

function pickEmotion(text: string) {
  if (/幸福|开心|快乐|满足|感动|安心/.test(text)) return "幸福";
  if (/委屈|难过|伤心|失落|孤独/.test(text)) return "难过";
  if (/焦虑|紧张|压力|烦|累|疲惫|加班/.test(text)) return "疲惫";
  if (/生气|愤怒/.test(text)) return "生气";
  if (/平静|放松|释然/.test(text)) return "平静";
  return "柔软";
}

function pickPalette(text: string) {
  if (/幸福|开心|快乐|满足|庆祝|妈妈|饭|吃|鹅腿/.test(text)) return palettes.warm;
  if (/焦虑|紧张|累|疲惫|加班|工作/.test(text)) return palettes.blue;
  if (/平静|放松|释然|雨|夜/.test(text)) return palettes.calm;
  return palettes.bright;
}

function pickTitle(text: string, feedback?: string) {
  if (feedback && /标题|名字|歌名/.test(feedback)) {
    if (/轻|亮|快乐|开心/.test(feedback)) return "微光上扬";
    if (/安静|慢|柔/.test(feedback)) return "慢慢安静";
    return "新的回声";
  }
  if (/妈妈|母亲|鹅腿|饭|菜|味道/.test(text)) return "妈妈的味道";
  if (/加班|工作|同事|老板|会议/.test(text)) return "灯下缓慢";
  if (/朋友|同学|一起|聊天/.test(text)) return "并肩的风";
  if (/雨|下雨/.test(text)) return "雨后的心事";
  if (/开心|幸福|快乐|满足/.test(text)) return "温柔亮起";
  if (/难过|委屈|失落/.test(text)) return "轻轻接住";
  return "今天的回声";
}

function makeSummary(text: string, emotion: string) {
  if (/妈妈|母亲|鹅腿|饭|菜|味道/.test(text)) {
    return "今天的味道让我想起被好好照顾的幸福。";
  }
  if (/加班|工作|会议|老板/.test(text)) {
    return "忙碌的一天里，我想把疲惫慢慢放下来。";
  }
  if (/朋友|同学|聊天/.test(text)) {
    return "有人并肩听我说话，让今天变得没那么孤单。";
  }
  if (/雨|下雨/.test(text)) {
    return "雨声把今天的心事放慢了一点。";
  }
  if (emotion === "幸福") return "今天有一个很小但很亮的瞬间，被我认真记住了。";
  if (emotion === "难过") return "有些情绪没有马上过去，但我想温柔地接住它。";
  if (emotion === "疲惫") return "我走过了很累的一天，也想给自己一点安静。";
  return "今天的某个瞬间，在心里留下了柔软的回声。";
}

function makeFullDiary(text: string, emotion: string) {
  const cleanText =
    text.length > 0
      ? text.replace(/\s+/g, " ").slice(0, 180)
      : "我试着回想今天最留在心里的那一刻";

  if (/妈妈|母亲|鹅腿|饭|菜|味道/.test(text)) {
    return `今天最留在我心里的，是和妈妈有关的味道。也许只是吃到她做的一道菜，可那一刻我真的感觉自己被照顾着。\n\n那种幸福不是很吵的开心，更像热气慢慢升起来，把一天里别的杂音都盖过去。我想把这个瞬间留下来，因为它提醒我，生活里还有很具体、很踏实的爱。`;
  }

  return `今天我一直记得的是：${cleanText}。\n\n这件事让我靠近一种${emotion}的感觉。它不是一定要被解释清楚，也不一定要马上变好，但我想把它放进今天的日记里，让它有一个安静的位置。\n\n如果今天有一首歌，我希望它不用替我回答什么，只要陪我把这一段慢慢听完。`;
}

function makeCoverMeta(text: string, title: string, feedback?: string): CoverMeta {
  const palette = pickPalette(`${text} ${feedback ?? ""}`);
  const query = [title, pickEmotion(text), "quiet mobile diary cover"].join(", ");

  return {
    query,
    source: "mock-programmatic",
    description: `为“${title}”生成的安静封面，占位替代 DeepSeek web search 结果。`,
    palette,
  };
}

function makeMusicPrompt(text: string, title: string, feedback?: string) {
  const emotion = pickEmotion(`${text} ${feedback ?? ""}`);
  const direction = /轻快|明亮|开心|上扬/.test(feedback ?? "")
    ? "slightly brighter, gentle uplift"
    : /慢|安静|柔|平静/.test(feedback ?? "")
      ? "slow, intimate, quiet"
      : "warm, intimate, reflective";

  return [
    `Instrumental short piece named "${title}".`,
    `Mood: ${emotion}, ${direction}.`,
    "No vocals, no lyrics. Soft piano, light pads, subtle texture, diary-like intimacy.",
  ].join(" ");
}

export function createMockCard(messages: ChatMessage[]): CardPayload {
  const text = getUserText(messages);
  const emotion = pickEmotion(text);
  const title = pickTitle(text);
  const now = new Date().toISOString();

  return {
    id: makeId("card"),
    createdAt: now,
    updatedAt: now,
    date: todayInShanghai(),
    title,
    summary: makeSummary(text, emotion),
    fullDiary: makeFullDiary(text, emotion),
    coverMeta: makeCoverMeta(text, title),
    musicPrompt: makeMusicPrompt(text, title),
    audioSeed: `${text}|${title}|${emotion}`,
    coverSeed: `${title}|${emotion}|${now}`,
  };
}

export function regenerateMockCard(current: CardPayload, feedback: string): CardPayload {
  const normalizedFeedback = feedback.trim();
  const feedbackText = normalizedFeedback.replace(/[。！？!?.,，；;]+$/, "");
  const changesText = `${current.fullDiary} ${normalizedFeedback}`;
  const now = new Date().toISOString();
  const musicOnly = /只改音乐|只让音乐|保留日记|不改日记|文字不变|内容不变/.test(
    normalizedFeedback,
  );
  const shouldChangeTitle =
    !musicOnly && /标题|名字|歌名|整张|全部|重做/.test(normalizedFeedback);
  const shouldChangeText =
    !musicOnly && /日记|摘要|文字|内容|整张|全部|重做/.test(normalizedFeedback);
  const shouldChangeCover =
    !musicOnly && /封面|图片|颜色|画面|整张|全部|重做/.test(normalizedFeedback);
  const nextTitle = shouldChangeTitle ? pickTitle(changesText, normalizedFeedback) : current.title;
  const nextSummary = shouldChangeText
    ? `${current.summary.replace(/。$/, "")}，也更靠近我刚刚说的调整。`
    : current.summary;

  return {
    ...current,
    id: makeId("card"),
    updatedAt: now,
    title: nextTitle,
    summary: nextSummary,
    fullDiary: shouldChangeText
      ? `${current.fullDiary}\n\n后来我又补充了一个愿望：${feedbackText}。我希望这张日记能更准确地靠近现在的我。`
      : current.fullDiary,
    coverMeta: shouldChangeCover
      ? makeCoverMeta(changesText, nextTitle, normalizedFeedback)
      : current.coverMeta,
    musicPrompt: makeMusicPrompt(changesText, nextTitle, normalizedFeedback),
    audioSeed: `${current.audioSeed}|regen|${normalizedFeedback}|${now}`,
    coverSeed: shouldChangeCover
      ? `${nextTitle}|${normalizedFeedback}|${now}`
      : current.coverSeed,
  };
}
