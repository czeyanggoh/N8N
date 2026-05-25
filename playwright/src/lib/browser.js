// Browser factory: headed Chromium with playwright-extra + stealth plugin.
// Persists storage state to /app/state so the bank sees a returning device fingerprint.

const path = require('path');
const fs = require('fs');
const { chromium: chromiumExtra } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromiumExtra.use(stealth);

const STATE_DIR = path.join('/app', 'state');
const STATE_FILE = path.join(STATE_DIR, 'storage-state.json');

if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

async function launchContext({ logger }) {
  const browser = await chromiumExtra.launch({
    headless: process.env.HEADLESS === 'true',
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
    ],
  });

  const contextOpts = {
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    locale: 'en-SG',
    timezoneId: 'Asia/Singapore',
  };

  if (fs.existsSync(STATE_FILE)) {
    logger.info({ STATE_FILE }, 'reusing storage state');
    contextOpts.storageState = STATE_FILE;
  }

  const context = await browser.newContext(contextOpts);
  return { browser, context };
}

async function persistState(context, logger) {
  await context.storageState({ path: STATE_FILE });
  logger.info({ STATE_FILE }, 'saved storage state');
}

module.exports = { launchContext, persistState, STATE_FILE };
