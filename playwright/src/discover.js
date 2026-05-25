// One-time discovery: launches Playwright with codegen so you can record real DBS selectors.
// Usage: docker compose exec playwright node src/discover.js
// Note: requires a forwarded display or VNC into the container — see docs/discovery.md.

require('dotenv').config();
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(process.env.DBS_IDEAL_URL || 'https://ideal.dbs.com.sg/');

  // Pause keeps the browser open so you can use the Playwright Inspector to pick selectors.
  await page.pause();

  await browser.close();
})();
