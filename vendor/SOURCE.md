# vendor 来源记录

| 文件 | 来源 | 版本 |
|---|---|---|
| `gsap.min.js` | npm `gsap` 包 `dist/gsap.min.js` | 3.15.0 |
| `ScrollTrigger.min.js` | npm `gsap` 包 `dist/ScrollTrigger.min.js` | 3.15.0 |
| `CustomEase.min.js` | npm `gsap` 包 `dist/CustomEase.min.js` | 3.15.0 |

三个文件必须保持同一 GSAP 版本,不可单独升级其中一个。License: [Standard "No Charge" GSAP license](https://gsap.com/community/standard-license/)(GreenSock 现行免费商用协议,含 ScrollTrigger/CustomEase 等原 Club 插件)。获取方式:`npm install gsap` 后从 `node_modules/gsap/dist/` 直接复制,未做任何修改。
