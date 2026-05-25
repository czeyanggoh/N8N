# Auto-deploy on push to main

GitHub webhook -> webhook.js on the VPS -> deploy.sh (pull + rebuild playwright container).

## One-time setup

### 1. Create the GitHub repo
Empty private repo on github.com (e.g. `cy/dbs-automation`). Do NOT init with README.

### 2. Add a deploy key (push from VPS)
On the VPS:
```
ssh-keygen -t ed25519 -C "vps-deploy" -f /root/.ssh/github_deploy -N ""
cat /root/.ssh/github_deploy.pub
```
On GitHub: Repo -> Settings -> Deploy keys -> Add deploy key -> paste -> check "Allow write access".

Tell git which key to use:
```
cat >> /root/.ssh/config <<'EOF'
Host github-dbs
    HostName github.com
    User git
    IdentityFile /root/.ssh/github_deploy
    IdentitiesOnly yes
EOF
chmod 600 /root/.ssh/config
```

### 3. Push the initial commit
```
cd /opt/dbs-automation
git remote add origin git@github-dbs:YOUR_USER/dbs-automation.git
git add . && git commit -m "Initial scaffold"
git push -u origin main
```

### 4. Install the webhook listener
```
cd /opt/dbs-automation/deploy
cp webhook.env.example webhook.env   # set WEBHOOK_SECRET
cp webhook.service /etc/systemd/system/dbs-deploy-webhook.service
systemctl daemon-reload
systemctl enable --now dbs-deploy-webhook
```

### 5. Expose the webhook via Traefik
Add a router so GitHub can reach the listener over HTTPS. Simplest: add Traefik labels to a small container wrapper, OR point a subdomain (e.g. `deploy.cy-bm.sg`) at the host's 9000.

### 6. Configure the GitHub webhook
Repo -> Settings -> Webhooks -> Add webhook
- Payload URL: `https://deploy.cy-bm.sg/`
- Content type: `application/json`
- Secret: same as WEBHOOK_SECRET
- Events: Just the `push` event

## Deploy lifecycle
1. `git push origin main`
2. GitHub POST -> webhook.js verifies HMAC
3. Runs deploy.sh: git pull + docker compose up -d --build playwright
4. New container live in ~30s

Logs: `journalctl -u dbs-deploy-webhook -f`
