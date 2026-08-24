# Owen Web · Inner Mountain

一个成熟 HR 领导者的个人 Profile 网站(V8 · Poetic Double Thread)。

深墨绿编辑式暗色语言,把「外在建设」与「内在山」两条线织进同一个连续滚动场域。职业叙事是公开结构,原创诗词与觉察记录作为内在线索嵌入其中。

## 运行

纯静态站点,零构建。任选其一:

```bash
# 直接用任意静态服务器
python3 -m http.server 5180
# 然后打开 http://localhost:5180/index.html
```

或直接用浏览器打开 `index.html`。

## 技术

- 单文件 `index.html`(结构 + 样式内联)
- 动效:GSAP + ScrollTrigger + CustomEase(本地 vendored,见 `vendor/SOURCE.md`)
- 字体:Satoshi / Cabinet Grotesk / Clash Display(自托管 woff2,见 `assets/fonts/SOURCE.md`)
- 渐进增强:vendor 加载失败时页面回落为完整可读的静态页;`prefers-reduced-motion` 移除非必要动效

## 说明

当前所有姓名、职位、指标、引用、联系方式均为 `DEMO / 待确认` 占位,须替换为核实内容后再对外发布。设计契约与内容状态见 `DESIGN.md`。

## 演进方向

这是从单文件 HTML 起步的基线,后续将逐步进化为项目级结构(构建、组件化、内容与展示分离)。
