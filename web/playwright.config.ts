import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — P6 E2E.
 *
 * Spins up the Vite dev server automatically via `webServer`. Tests target
 * the PWA shell + critical flows (guest, auth, admin). Backend and Firebase
 * emulators are expected to be running externally (`bun run emulators:up`).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Force emulator wiring so E2E never hits a real Firebase project,
        // even if the dev's own .env.local points at one. The synthetic
        // VITE_FIREBASE_CONFIG pins the client's project id to
        // `quartinho-dev` so Auth tokens and the emulator (which runs under
        // the same project) agree on `aud`.
        command:
          'VITE_USE_EMULATOR=true ' +
          'VITE_API_URL=http://localhost:3001 ' +
          "VITE_FIREBASE_CONFIG='{\"apiKey\":\"fake-e2e-key\",\"authDomain\":\"quartinho-dev.firebaseapp.com\",\"projectId\":\"quartinho-dev\",\"storageBucket\":\"quartinho-dev.appspot.com\",\"messagingSenderId\":\"0\",\"appId\":\"e2e\",\"databaseURL\":\"http://localhost:9000/?ns=quartinho-dev\"}' " +
          'bun run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
