# DBS IDEAL Payment Upload Automation

n8n + Playwright stack running on the VPS that accepts a payment file via n8n's web form, then drives DBS IDEAL (corporate banking) in a stealth headed browser to upload it.

## Architecture

```
User → n8n form (HTTPS)
        │
        ▼
   n8n workflow ── HTTP ──▶ playwright service (Docker)
        ▲                         │
        │                         ▼
   responds to user        DBS IDEAL (headed Chromium + stealth, Xvfb)
```

Both n8n and the playwright service live on the same Docker network so n8n talks to playwright via `http://playwright:3000`.

## Folders

- `playwright/` — Node service that exposes HTTP endpoints for n8n to call. Runs Chromium headed under Xvfb with `playwright-extra` + stealth plugin.
- `n8n-workflows/` — JSON workflow exports. Import via n8n UI → Workflows → Import from File.
- `deploy/` — GitHub webhook listener + deploy script for auto-pull on push to `main`.
- `docs/` — runbooks (DBS selector discovery, MFA flow, recovery).

## Quickstart

```bash
cd /opt/dbs-automation
cp playwright/.env.example playwright/.env   # fill in DBS_USERNAME/DBS_PASSWORD/DBS_ORG_NAME
docker compose -f /docker/n8n/docker-compose.yml -f docker-compose.override.yml up -d --build
```

Import `n8n-workflows/dbs-payment-upload.json` in n8n. Activate the workflow. The form URL is shown in the trigger node.

## Auto-deploy

`git push` to `main` on GitHub triggers a webhook → the VPS pulls + rebuilds the playwright container. See `deploy/README.md`.

## Status

| Component                 | State       |
|---------------------------|-------------|
| Scaffold + Docker stack   | scaffolded |
| Stealth Playwright runner | built     |
| DBS login flow            | selectors are placeholders — needs one headed discovery run on real account |
| Organisation selection    | ditto |
| Payment file upload       | ditto — also depends on file format (BIBF, ISO 20022 pain.001, etc.) |
| Digital token MFA wait    | polls for post-MFA URL with timeout |
| n8n workflow              | form + HTTP call wired |
| GitHub auto-deploy        | needs repo URL + deploy key registered |

See `docs/discovery.md` for the one-time selector mapping step.
