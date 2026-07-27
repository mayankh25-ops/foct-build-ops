import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite. Runs against a PRODUCTION build (`next build && next start`),
 * not the dev server — dev-only behaviour has masked real bugs here before.
 *
 * Demo mode is deliberate: no Supabase env is set, so the specs exercise the
 * journeys every machine can run, including a fresh clone and CI. Live-mode
 * journeys (real pairing, real punches) belong to staging UAT, which is a
 * human step in docs/TESTING.md rather than a fake here.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const HOST = `http://127.0.0.1:${PORT}`;

/**
 * A SECOND server, built with placeholder Supabase env, so the kiosk's LIVE
 * path can be exercised in a real browser with the RPCs intercepted. Without
 * this, live mode is only ever unit-tested — and IndexedDB, bcrypt-in-browser
 * and the offline fallback are exactly the things unit tests can't prove.
 */
const LIVE_PORT = Number(process.env.E2E_LIVE_PORT ?? 3101);
const LIVE_HOST = `http://127.0.0.1:${LIVE_PORT}`;
const LIVE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://e2e-kiosk.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_e2e_placeholder",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // the demo stores are per-browser-context, not per-worker
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: HOST,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "desktop-chromium",
      // the phone and live-kiosk projects own their own specs
      testIgnore: /.*\.(mobile|live)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          // the kiosk selfie step needs a camera that always answers
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        },
      },
    },
    {
      name: "kiosk-live",
      testMatch: /.*\.live\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: LIVE_HOST,
        viewport: { width: 1280, height: 900 },
        launchOptions: {
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        },
      },
    },
    {
      name: "mobile-chromium",
      testMatch: /.*\.mobile\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        launchOptions: {
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        },
      },
    },
  ],
  webServer: [
    {
      command: `npm run build && npx next start -p ${PORT}`,
      url: HOST,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      // its own .next dir, so the two builds never overwrite each other
      command: `next build --no-lint && npx next start -p ${LIVE_PORT}`,
      url: LIVE_HOST,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      stdout: "ignore",
      stderr: "pipe",
      env: { ...LIVE_ENV, NEXT_DIST_DIR: ".next-live" },
    },
  ],
});
