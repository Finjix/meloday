# Meloday

在线体验：[https://meloday.vercel.app](https://meloday.vercel.app)

Meloday 是一款面向移动端的音乐日记 Web 应用，用户可以用文字向温柔陪伴型 agent 讲述今天的经历，agent 通过渐进式提问理解事件、情绪和心理需求，再生成包含纯器乐 AI 音乐、音乐名、封面、简短摘要和完整日记的卡片；当前 MVP 基于 Next.js、TypeScript、自定义 CSS 和本地浏览器存储实现。

## 目录约定

- `src/app`：页面、布局和 Next.js API 路由。
- `src/components`：可复用的基础组件，如音频、封面和导航。
- `src/features`：按业务功能组织的页面组件。
- `src/lib`：客户端接口、服务端能力和本地数据逻辑。
- `src/styles`：全局基础样式及按页面职责拆分的 CSS，通过 `index.css` 统一引入。
