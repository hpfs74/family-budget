import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env['CI']
      ? 'npx vite preview --host localhost --port 4200'
      : 'npx vite dev --host localhost --port 4200',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    cwd: `${workspaceRoot}/apps/frontend`,
  },
});
