import { defineConfig, devices } from "@playwright/test";

// The Linux app runs on WebKitGTK; CI sets PW_WEBKIT=1 so that engine is tested at two sizes.
const webkit = process.env.PW_WEBKIT
  ? [
      {
        name: "webkit-laptop",
        use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } },
      },
      {
        name: "webkit-phone",
        use: {
          browserName: "webkit" as const,
          viewport: { width: 360, height: 740 },
          hasTouch: true,
          isMobile: true,
        },
      },
    ]
  : [];

// The widths every screen must survive. Keep in sync with AGENTS.md → "Responsive".
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:1420" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } }, // 412×915, touch, coarse pointer
    {
      name: "phone-small",
      use: { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true },
    },
    {
      name: "tablet",
      use: { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true },
    },
    { name: "laptop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "wide", use: { viewport: { width: 1920, height: 1080 } } },
    ...webkit,
  ],
});
