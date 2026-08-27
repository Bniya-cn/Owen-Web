import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  // 只收 .spec.ts,避免误收将来可能出现的 node:test 单测文件(*.test.mjs)。
  testMatch: /.*\.spec\.ts/,
  timeout: 60000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5180",
    viewport: { width: 1440, height: 900 },
  },
  // 测产物而非 dev server:构建后的行为才是要交付的行为。
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://127.0.0.1:5180",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
