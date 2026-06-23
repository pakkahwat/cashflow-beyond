import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:8080' },
  webServer: {
    command: 'npm run build && PORT=8080 npm run start:prod',
    url: 'http://localhost:8080',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
