import type { AgentTurnResult, ChatMessage, CollectedSignals } from "@/lib/types";

const emotionWords = [
  "开心",
  "幸福",
  "快乐",
  "感动",
  "轻松",
  "安心",
  "难过",
  "伤心",
  "委屈",
  "焦虑",
  "紧张",
  "生气",
  "烦",
  "累",
  "失落",
  "孤独",
  "平静",
  "满足",
  "害怕",
  "释然",
];

const needWords = [
  "安慰",
  "陪",
  "陪伴",
  "理解",
  "被看见",
  "记住",
  "庆祝",
  "鼓励",
  "放松",
  "平静",
  "放下",
  "告别",
  "释放",
  "抱抱",
  "力量",
];

export function analyzeConversation(messages: ChatMessage[]): CollectedSignals {
  const userMessages = messages.filter((message) => message.role === "user");
  const userText = userMessages.map((message) => message.content).join("\n");
  const compactText = userText.replace(/\s+/g, "");

  const event =
    compactText.length >= 12 ||
    /今天|早上|中午|晚上|下午|昨天|刚刚|妈妈|爸爸|朋友|同事|老板|工作|学校|回家|吃|见|聊|加班|下雨/.test(
      compactText,
    );
  const emotion = emotionWords.some((word) => compactText.includes(word));
  const explicitNeed = needWords.some((word) => compactText.includes(word));

  return {
    event,
    emotion,
    need: explicitNeed || (event && emotion && userMessages.length >= 3),
  };
}

export function getMockAgentTurn(messages: ChatMessage[]): AgentTurnResult {
  const collected = analyzeConversation(messages);
  const userMessages = messages.filter((message) => message.role === "user");

  if (userMessages.length >= 3) {
    return {
      action: "generate",
      collected,
      message:
        "我大概懂了。今天的你不是只想记录一件事，更像是想把那一刻被触动、被消耗或被照亮的感觉轻轻收起来。我来把它写成一首只属于今天的器乐日记。",
    };
  }

  if (!collected.event) {
    return {
      action: "question",
      collected,
      message:
        "你愿意先从今天最留在心里的一个画面讲起吗？不用完整，只说那一刻发生了什么就好。",
    };
  }

  if (!collected.emotion) {
    return {
      action: "question",
      collected,
      message:
        "听起来那件事在你心里留下了一点重量。那一刻你更靠近哪种感觉：开心、委屈、疲惫、安心，还是别的什么？",
    };
  }

  return {
    action: "question",
    collected,
    message:
      "如果把今天交给一首歌，你希望它替你做什么？是安慰你、陪你安静一会儿、帮你庆祝一下，还是让某种心情慢慢放下？",
  };
}
