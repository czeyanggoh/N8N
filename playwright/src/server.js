require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const logger = require('./lib/logger');
const { launchContext, persistState } = require('./lib/browser');
const { login, selectOrganisation, uploadPaymentFile, logout } = require('./lib/dbs');

const PORT = parseInt(process.env.PORT || '3000', 10);
const API_KEY = process.env.PLAYWRIGHT_API_KEY;
const ORG_MAP_PATH = process.env.ORG_MAP_PATH || '/repo/config/org-map.json';

if (!API_KEY) {
  logger.error('PLAYWRIGHT_API_KEY not set — refusing to start');
  process.exit(1);
}

// Load org mapping (friendly name / Xero name → DBS org picker display string)
function loadOrgMap() {
  try {
    const raw = fs.readFileSync(ORG_MAP_PATH, 'utf8');
    return JSON.parse(raw).orgs || {};
  } catch (err) {
    logger.warn({ err: err.message, ORG_MAP_PATH }, 'could not load org-map.json — using raw orgName');
    return {};
  }
}

function resolveDbsOrgName(inputName) {
  if (!inputName) return process.env.DBS_ORG_NAME || null;
  const map = loadOrgMap();
  // Exact match first, then case-insensitive
  if (map[inputName]) return map[inputName];
  const lower = inputName.toLowerCase();
  const found = Object.entries(map).find(([k]) => k.toLowerCase() === lower);
  if (found) return found[1];
  // No mapping found — pass through as-is (works if user typed the DBS display string directly)
  logger.warn({ inputName }, 'no org-map entry found — using raw value as DBS org name');
  return inputName;
}

const UPLOAD_DIR = '/app/uploads';
const SHOT_DIR = '/app/screenshots';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(SHOT_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  if (req.path === '/health') return next();
  if (req.get('X-API-Key') !== API_KEY) return res.status(401).json({ error: 'unauthorized' });
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// GET /orgs — list available friendly names so n8n/callers can validate
app.get('/orgs', (_req, res) => {
  const map = loadOrgMap();
  res.json({ orgs: Object.keys(map) });
});

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file field required' });

  const inputOrgName = (req.body && req.body.orgName) || null;
  const dbsOrgName = resolveDbsOrgName(inputOrgName);

  const filePath = req.file.path;
  const requestId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const log = logger.child({ requestId, inputOrgName, dbsOrgName });

  log.info({ originalname: req.file.originalname, size: req.file.size }, 'upload received');

  let browser, screenshotPath;
  try {
    const ctx = await launchContext({ logger: log });
    browser = ctx.browser;
    const page = await ctx.context.newPage();

    await login(page, log);
    await selectOrganisation(page, dbsOrgName, log);
    await uploadPaymentFile(page, filePath, log);
    await persistState(ctx.context, log);
    await logout(page, log);

    screenshotPath = path.join(SHOT_DIR, requestId + '-success.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    res.json({ ok: true, requestId, inputOrgName, dbsOrgName,
      screenshot: path.basename(screenshotPath) });
  } catch (err) {
    log.error({ err: err.message }, 'flow failed');
    if (browser) {
      try {
        const pages = browser.contexts()[0]?.pages() || [];
        if (pages[0]) {
          screenshotPath = path.join(SHOT_DIR, requestId + '-error.png');
          await pages[0].screenshot({ path: screenshotPath, fullPage: true });
        }
      } catch (_) {}
    }
    res.status(500).json({ ok: false, requestId, inputOrgName, dbsOrgName,
      error: err.message, screenshot: screenshotPath ? path.basename(screenshotPath) : null });
  } finally {
    if (browser) await browser.close().catch(() => {});
    fs.unlink(filePath, () => {});
  }
});

app.get('/screenshots/:name', (req, res) => {
  const safe = path.basename(req.params.name);
  const p = path.join(SHOT_DIR, safe);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' });
  res.sendFile(p);
});

app.listen(PORT, () => logger.info({ PORT }, 'playwright service listening'));
