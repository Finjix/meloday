# Meloday

Meloday 是一款面向移动端的音乐日记 Web 应用，用户可以用文字向温柔陪伴型 agent 讲述今天的经历，agent 通过渐进式提问理解事件、情绪和心理需求，再生成包含纯器乐 AI 音乐、音乐名、封面、简短摘要和完整日记的卡片；当前 MVP 基于 Next.js、TypeScript、Tailwind CSS 和本地浏览器存储实现。

真实生成链路需要配置 DeepSeek 和 MiniMax API Key。服务端会优先读取 `.env.local` 或部署环境变量，也支持在应用“我的”页填写本地 key 作为开发/个人使用兜底。

```bash
DEEPSEEK_API_KEY=...
MINIMAX_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
MINIMAX_API_HOST=https://api.minimaxi.com
MINIMAX_MUSIC_MODEL=music-2.0
```
