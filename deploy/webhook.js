// Tiny GitHub webhook listener: verify HMAC, run deploy.sh on push to main.
// Zero npm deps — runs with /usr/bin/node from Ubuntu's nodejs package.

const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SECRET = process.env.WEBHOOK_SECRET;
const PORT = parseInt(process.env.WEBHOOK_PORT || '9000', 10);
const BRANCH = process.env.WEBHOOK_BRANCH || 'main';
const REPO_DIR = process.env.REPO_DIR || '/opt/dbs-automation';
const DEPLOY_SCRIPT = path.join(REPO_DIR, 'deploy', 'deploy.sh');

if (!SECRET) { console.error('WEBHOOK_SECRET not set, aborting'); process.exit(1); }
if (!fs.existsSync(DEPLOY_SCRIPT)) { console.error('Deploy script missing: ' + DEPLOY_SCRIPT); process.exit(1); }

let deployRunning = false;

function verify(body, signature) {
  if (!signature) return false;
  const mac = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  const a = Buffer.from(mac);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }
  let chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    if (!verify(body, req.headers['x-hub-signature-256'])) {
      res.writeHead(401).end('bad signature'); return;
    }
    let payload;
    try { payload = JSON.parse(body.toString('utf8')); }
    catch { res.writeHead(400).end('bad json'); return; }
    if (req.headers['x-github-event'] !== 'push') { res.writeHead(200).end('ignored: not a push'); return; }
    if (payload.ref !== 'refs/heads/' + BRANCH) { res.writeHead(200).end('ignored: not ' + BRANCH); return; }
    if (deployRunning) { res.writeHead(429).end('deploy already running'); return; }
    deployRunning = true;
    res.writeHead(202).end('deploying');
    console.log('[deploy] push by ' + (payload.pusher && payload.pusher.name) + ' on ' + payload.ref);
    const child = spawn('bash', [DEPLOY_SCRIPT], { stdio: 'inherit', env: process.env });
    child.on('exit', (code) => { deployRunning = false; console.log('[deploy] exit ' + code); });
  });
});

server.listen(PORT, '0.0.0.0', () => console.log('webhook listening on 127.0.0.1:' + PORT));
