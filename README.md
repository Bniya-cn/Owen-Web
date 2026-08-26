# Owen Web · Inner Mountain

一个成熟 HR 领导者的个人 Profile 网站(V8 · Poetic Double Thread)。

深墨绿编辑式暗色语言,把「外在建设」与「内在山」两条线织进同一个连续滚动场域。职业叙事是公开结构,原创诗词与觉察记录作为内在线索嵌入其中。

## 运行

Vite 工程,需先安装依赖:

```bash
npm install

# 开发(127.0.0.1:5178)
npm run dev

# 生产构建 + 预览构建产物(127.0.0.1:5180)
npm run build
npm run preview
```

注意:`index.html` 通过绝对路径引用 `/src/styles/*.css` 与 ES module 入口 `/src/main.js`,
必须经 Vite(或 `dist/` 构建产物)提供服务,不能直接双击打开或用裸静态服务器打开源文件。

## 脚本

- `npm run dev` — 开发服务器(端口 5178)。
- `npm run build` — 生产构建,输出到 `dist/`(`base: "./"`,可直接部署到任意子路径)。
- `npm run preview` — 预览 `dist/`(端口 5180)。
- `npm run check:placeholders` — 占位符规范检查(`DEMO / 待确认` 必须完整出现)。
- `npm run test:experience` — Playwright 体验测试(测试目标为构建产物而非 dev 服务器)。
- `npm run verify` — 顺序执行占位符检查、构建与体验测试。

## 技术

- `index.html` 只承载 11 章语义化 DOM;样式与脚本已拆分为独立模块。
- 样式:`src/styles/` 下 8 个文件 —— `tokens`(色板)、`fonts`、`base`、`typography`、`components`、`scene`、`motion`、`responsive`。
- 脚本:`src/main.js` 为入口。交互层(`src/interactions/`)静态导入、任何情况都必须工作;
  动效层(`src/motion/`)与常驻场景层(`src/scene/`)各自动态导入、独立降级。
- 动效:GSAP 3.15.0 + ScrollTrigger + CustomEase(npm 依赖,与动效层同 chunk 懒加载)。
- 字体:Satoshi / Cabinet Grotesk / Clash Display(自托管 woff2,见 `assets/fonts/SOURCE.md`)。
- 渐进增强:动效或场景层加载失败时,`html` 拿不到 `.motion-ready`,内容停在完全可见的静态状态;
  `prefers-reduced-motion` 移除非必要动效。页面永远不依赖 JavaScript 才可读。

## 目录

```
index.html             11 章语义化 DOM(内容单一事实来源)
src/styles/            样式模块(8 个文件)
src/interactions/      功能性交互(轨道信号、工作协议、章节状态)
src/motion/            GSAP 滚动揭示动效(含 motion-ready 初始化事务与独立提交的进度层)
src/scene/             常驻场景层(光场、轨迹、节点布局、主时间线)
assets/fonts/          自托管字体(见 SOURCE.md)
assets/images/         章节氛围图 WebP 运行时(journey/beliefs/invite,懒载,唯一进构建的图像)
design-system/         基础与组件设计参考页
dist/                  构建产物
artifacts/             测试产物(概念图、前后截图、测试报告;不进构建)
artifacts/source/      章节图生成源 PNG(仅归档,不进构建)
```

`vendor/` 为历史 vendored GSAP 副本,当前构建已不再引用,仅留作来源记录。

章节氛围图以 `<img class="chapter-plate" loading="lazy" decoding="async" alt="">` 真实懒载,
绝对定位在场景层之上、内容之下,羽化蒙版 `mask-image` + `-webkit-mask-image` 双写,
不支持时退化为低透明度完整图;加载失败不影响正文可读。

## 说明

当前所有姓名、职位、指标、引用、联系方式均为 `DEMO / 待确认` 占位,须替换为核实内容后再对外发布。设计契约与内容状态见 `DESIGN.md`。
