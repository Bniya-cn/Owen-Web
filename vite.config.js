import { defineConfig } from "vite";

export default defineConfig({
  // 相对基址:保证 preview 在裸根可达(测试打 127.0.0.1:5180),
  // 同时 GitHub Pages 的 /Owen-Web/ 子路径部署也无需改配置。
  base: "./",
  build: {
    target: "es2022",
    // 自托管 woff2 必须始终是独立文件,不允许被内联进 JS。
    assetsInlineLimit: 0,
  },
  // 显式绑定 IPv4:默认只监听 ::1,会让打 127.0.0.1 的测试连接失败。
  server: { port: 5178, strictPort: true, host: "127.0.0.1" },
  preview: { port: 5180, strictPort: true, host: "127.0.0.1" },
});
