const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './specs',
  timeout: 120000,           // 2分钟，大文件处理需要时间
  expect: { timeout: 15000 },
  fullyParallel: false,       // 顺序执行，避免文件操作干扰
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3077',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    downloadPath: './test-downloads',
    locale: 'zh-CN',
  },
  webServer: {
    command: 'node server.js',
    port: 3077,
    reuseExistingServer: true,
    timeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } },
    },
  ],
});
