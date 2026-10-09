import { defineConfig, devices } from "@playwright/test";

// Pruebas de extremo a extremo de la parte pública (funcionan también en modo demostración).
// E2E_BASE_URL permite apuntar a un servidor ya iniciado; si no, se compila e inicia uno.
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: external ?? "http://localhost:3200", trace: "retain-on-failure" },
  projects: [
    { name: "movil", use: { ...devices["Pixel 7"], launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } },
    { name: "escritorio", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } },
  ],
  webServer: external ? undefined : { command: "npm run build && npx next start -p 3200", url: "http://localhost:3200", timeout: 240_000, reuseExistingServer: true },
});
