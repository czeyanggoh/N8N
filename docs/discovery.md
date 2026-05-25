# DBS IDEAL selector discovery (one-time)

The selectors in `playwright/src/lib/dbs.js` are guesses based on common patterns. You need to confirm them once against the live site, then commit the updates.

## Why this is a separate step

DBS IDEAL is behind login, and the HTML structure varies by organisation type (SME vs Corporate vs IDEAL 3.0). Inspecting it from outside isn't possible without an account.

## Recommended: record with Playwright Codegen on your laptop

Easiest path is to **not** do this on the VPS — run codegen locally:

```bash
# On your laptop (one-off)
npx playwright codegen https://ideal.dbs.com.sg/ \
  --viewport-size=1920,1080 \
  --browser=chromium
```

A browser opens. Walk through:
1. Login screen → enter username/password, click Login
2. Approve digital token on phone
3. If org picker shows: pick your org
4. Navigate: Payments → File Upload (or Bulk Payments)
5. Upload a test file
6. Logout

Codegen prints suggested locators to a sidebar. Copy the locators into `playwright/src/lib/dbs.js`, replacing the `S` constants. Commit + push.

## Alternative: VNC into the container

```bash
docker compose exec playwright bash -lc "apt-get update && apt-get install -y x11vnc && x11vnc -display :99 -nopw -listen 0.0.0.0 -forever"
# Then SSH tunnel: ssh -L 5900:localhost:5900 root@76.13.187.208
# Connect a VNC viewer to localhost:5900
docker compose exec playwright node src/discover.js
```

## Things that usually need updating

- `loginUsername`, `loginPassword`, `loginSubmit` — often inside an iframe; if so, use `page.frameLocator('#login-frame').locator(...)`.
- `postLoginUrlPattern` — confirm the URL path after MFA success.
- `navPayments` / `navFileUpload` — IDEAL's nav uses dynamic IDs; prefer text-based locators.
- `uploadSuccess` — the success banner text varies by file type. Use the most specific phrase.

After updating, push to GitHub — auto-deploy rebuilds the container on the VPS within ~30s.
