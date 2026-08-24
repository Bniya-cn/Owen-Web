# HR Leader Profile · V8 Poetic Double Thread

## Design Read

Reading this as: a mature HR leader personal website for employees, candidates and business partners, with an immersive dark-forest editorial language where professional leadership and inner life form one continuous scrollytelling field.

## V8 narrative thesis

- The 11-section professional narrative remains the public structure.
- Original poetry and awareness notes form the inner thread. They explain how the leader observes, learns, decides and relates to others.
- Poetry is embedded as environmental type, chapter breath and expandable source material. It is not placed in a separate gallery, card wall or slide frame.
- The recurring motifs are inner stillness, goodwill, continuous learning, coherence and long-term growth.
- The primary arc begins with “伟大不能被计划，但可以在实践中偶遇，在碰撞中诞生”, turns toward “不是等待新的太阳，而是点亮群星”, and closes with “此去前路莫孤旅，宜将山花处处栽”.

## Direction contract

- The website is one continuous environment. There are no slide frames, centered paper boards, page numbers, side directories, tab bars, carousel arrows or footer panels.
- The palette is locked to the user's tokens: `#070A06`, `#0B100A`, `#10170B`, `#12190D`, `#142412`, `#314322`, `#3D5230`, `#4F6A31`, `#536133`, `#C7F464`, `#D7F685`, `#E8FF9E`. Warm amber is used only as a tiny DEMO status signal.
- Information is embedded in the environment: thin rules, field nodes, orbit lines, trajectory marks and softly lit regions. Nothing is pasted as a high-contrast card.
- No character images, portrait placeholders or stock photos are used in this first HTML proof. The layout is intentionally image-free so the identity, hierarchy and interaction can be judged before real leader photography is introduced.
- The leader is represented as a mature, experienced voice through restrained copy, measured scale and calm motion. When real imagery arrives, it should be a low-contrast edge-faded editorial asset, never a hero cutout repeated on every chapter.
- Motion is limited to scroll reveal, pointer light-field movement, signal rail drift and working-protocol selection. `prefers-reduced-motion` removes non-essential motion.

## Portrait adaptation contract

- 竖版是窄屏的优先阅读方式：所有双栏关系在 `840px` 以下改为单列，反向章节统一先显示标题与正文，再显示关系图或轨迹。
- 轨迹、节点、圆形场域和信号线都收进内容宽度，装饰层不得制造横向滚动；目标范围覆盖 `320px`、`360px`、`375px`、`390px` 和 `414px`。
- 页面使用 `100dvh`、安全区变量和触控友好的协议按钮，避免移动端地址栏变化造成跳动。

## Original narrative preserved

The 11 sections map one-to-one to the original plan: 我是谁、先认识这个人、我是如何走到这里的、这些经历让我相信、我看见的组织、我正在建设的未来、变化已经发生、我是如何工作的、别人眼中的我、工作之外、我的邀请。

## Content status

All names, metrics, roles, quotes and contact details are labelled `DEMO / 待确认` and must be replaced with verified content before public release.

For this V8 prototype, supplied poetry and awareness notes are treated as authored source material for composition. Public-release review is outside the prototype scope.

## V6.1 refinement addendum (2026-08-14)

This is an addendum, not a revision of the sections above — the direction, palette, and 11-section narrative committed to above are unchanged. It records what the V6.1 refinement pass added.

- **Typography**: Satoshi / Cabinet Grotesk / Clash Display are now actually loaded (previously referenced in CSS but silently falling back to system fonts) — self-hosted `.woff2` files under `assets/fonts/`, sourced from Fontshare's free CSS API. See `assets/fonts/SOURCE.md`.
- **Motion engine**: scroll reveal, the pointer light-field, and the top progress rail now run on GSAP + ScrollTrigger + CustomEase (vendored locally under `vendor/`, see `vendor/SOURCE.md`), replacing the previous vanilla `IntersectionObserver` / raw `pointermove` / CSS `animation-timeline: scroll()` implementation. This is progressive enhancement: if the vendor files fail to load for any reason, `html` never gets `.motion-ready` and all section content stays at its default fully-visible, unanimated state — the page never depends on JavaScript to be readable.
- **Two pre-existing bugs fixed** in the course of this migration (present since before V6.1, not introduced by it): the `#invite` section's contact-line (name / title / email) was permanently invisible because the old CSS reveal rule only handled a section's first 4 direct children and `#invite` has 5; and the top progress rail was permanently zero-width because its CSS had both `width: 0` and a `scaleX` transform on the same element.
- **New interactions**: the hero orbit's 4 `PEOPLE/BUSINESS/CULTURE/LISTEN` buttons (previously visual-only, no click handler) now reveal a one-line signal statement on click, single-select, with a one-shot (non-looping) ripple on the orbit rings. The "我是如何工作的" protocol selector now reveals a connected one-line explanation per item instead of being a purely decorative toggle. Both follow the same single-select interaction grammar and expose `aria-pressed`.
- **"变化已经发生" 35%**: gets a one-time count-up on scroll-in; the static HTML value is always the real final number (`35%`) — the count-up is a temporary visual overlay on top of that truth, not the source of it, so a JS failure or `prefers-reduced-motion` never risks showing a wrong or stuck number.
- **Wide-screen tiers**: additive `min-width: 1440px` / `1920px` CSS only — canvas ceiling, decorative-element size ceiling, and vertical rhythm grow modestly and then cap; nothing below `840px` was touched, and no new visual element was introduced (an ambient section-index rail was proposed and explicitly rejected to keep this a refinement, not new chrome).
- **Token hygiene**: `--middle`, `--source`, `--structure` (previously hardcoded twice as raw `rgb()` literals) now have `-rgb` sibling tokens and are referenced via `var()`. The three previously-unused tokens now have real jobs: `--journey` tints the `.trajectory` connector line's fade-out end; `--support` styles the plain structural divider borders (as distinct from the signal-green rings/borders tied to interactivity); `--olive-black` feeds the `min-width: 1920px` edge-depth layer. No new color value was introduced anywhere. `.field-rail` / `.field-rail__light` / `rail-drift` remain confirmed-unused dead CSS (no matching DOM element at any breakpoint) — left in place, not wired up, not extended.
- **Placeholder convention**: all data placeholders (witness citations, the invite contact line) now consistently read `DEMO / 待确认`. Section kickers (e.g. "Identity / DEMO") and the floating `#statusText` remain a separate, intentional "demo build" watermark, not a content placeholder governed by this convention — see the convention comment at the top of `<body>` in `index.html`.
