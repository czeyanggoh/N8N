// DBS IDEAL flow. Selectors are PLACEHOLDERS — confirm with one headed discovery run.
// See docs/discovery.md for the procedure.

const URL = process.env.DBS_IDEAL_URL || 'https://ideal.dbs.com.sg/';
const MFA_TIMEOUT_MS = parseInt(process.env.MFA_TIMEOUT_MS || '180000', 10);

const S = {
  loginUsername: 'input[name="username"], input#userId, [data-testid="username"]',
  loginPassword: 'input[name="password"], input[type="password"]',
  loginSubmit: 'button[type="submit"], button:has-text("Login"), button:has-text("Log In")',
  postLoginUrlPattern: /\/(dashboard|home|landing|accounts)/i,

  orgRow: (name) =>
    '[role="row"]:has-text(' + JSON.stringify(name) + '), li:has-text(' + JSON.stringify(name) + '), button:has-text(' + JSON.stringify(name) + ')',
  orgConfirm: 'button:has-text("Continue"), button:has-text("Confirm"), button:has-text("Select")',

  navPayments: 'a:has-text("Payments"), [data-nav="payments"]',
  navFileUpload: 'a:has-text("File Upload"), a:has-text("Bulk"), a:has-text("Upload Payment")',
  uploadInput: 'input[type="file"]',
  uploadSubmit: 'button:has-text("Upload"), button:has-text("Submit")',
  uploadSuccess: ':has-text("Success"), :has-text("uploaded"), [data-status="success"]',

  logout: 'a:has-text("Logout"), a:has-text("Log Out"), button:has-text("Logout")',
};

async function login(page, logger) {
  logger.info({ URL }, 'navigating to DBS IDEAL');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  const splashLogin = page.locator('a:has-text("Login"), a:has-text("Log In")').first();
  if (await splashLogin.isVisible({ timeout: 3000 }).catch(() => false)) {
    await splashLogin.click();
  }

  await page.locator(S.loginUsername).first().fill(process.env.DBS_USERNAME);
  await page.locator(S.loginPassword).first().fill(process.env.DBS_PASSWORD);
  await page.locator(S.loginSubmit).first().click();

  logger.info({ MFA_TIMEOUT_MS }, 'waiting for digital token approval on phone...');
  await page.waitForURL(S.postLoginUrlPattern, { timeout: MFA_TIMEOUT_MS });
  logger.info('MFA approved');
}

// orgName is passed explicitly per-request (from n8n form), not read from env here.
async function selectOrganisation(page, orgName, logger) {
  if (!orgName) {
    logger.warn('no orgName provided — skipping org picker (single-org account or caller omitted it)');
    return;
  }

  const picker = page.locator(S.orgRow(orgName)).first();
  if (!(await picker.isVisible({ timeout: 5000 }).catch(() => false))) {
    logger.info({ orgName }, 'no org picker visible — proceeding');
    return;
  }
  await picker.click();
  const confirm = page.locator(S.orgConfirm).first();
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirm.click();
  }
  logger.info({ orgName }, 'organisation selected');
}

async function uploadPaymentFile(page, filePath, logger) {
  logger.info({ filePath }, 'navigating to Payments → File Upload');
  await page.locator(S.navPayments).first().click();
  await page.locator(S.navFileUpload).first().click();

  await page.locator(S.uploadInput).first().setInputFiles(filePath);
  await page.locator(S.uploadSubmit).first().click();

  await page.locator(S.uploadSuccess).first().waitFor({ timeout: 60000 });
  logger.info('upload acknowledged by DBS');
}

async function logout(page, logger) {
  await page.locator(S.logout).first().click().catch(() => {
    logger.warn('logout link not found — closing session anyway');
  });
}

module.exports = { login, selectOrganisation, uploadPaymentFile, logout, S };
