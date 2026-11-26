// UDID Finder - zero-dependency Node.js server (Node 16+)
// Flow: index.html -> /profile.mobileconfig -> iOS installs -> POST /enroll -> 301 -> /result
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ORG_NAME = process.env.ORG_NAME || 'UDID Finder';
// Optional: set PUBLIC_URL=https://yourdomain.com if behind a proxy
const PUBLIC_URL = process.env.PUBLIC_URL || '';

function baseUrl(req) {
  if (PUBLIC_URL) return PUBLIC_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildProfile(req) {
  const uuid = crypto.randomUUID().toUpperCase();
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <dict>
    <key>URL</key>
    <string>${esc(baseUrl(req))}/enroll</string>
    <key>DeviceAttributes</key>
    <array>
      <string>UDID</string>
      <string>PRODUCT</string>
      <string>VERSION</string>
    </array>
  </dict>
  <key>PayloadOrganization</key>
  <string>${esc(ORG_NAME)}</string>
  <key>PayloadDisplayName</key>
  <string>Get UDID</string>
  <key>PayloadDescription</key>
  <string>This profile only reads your device UDID. It does not install anything else.</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadUUID</key>
  <string>${uuid}</string>
  <key>PayloadIdentifier</key>
  <string>com.udidfinder.profile.${uuid}</string>
  <key>PayloadType</key>
  <string>Profile Service</string>
</dict>
</plist>`;
}

// iOS posts a PKCS#7-signed blob that contains a plain XML plist inside.
function parseEnrollBody(buf) {
  const text = buf.toString('utf8');
  const m = text.match(/<\?xml[\s\S]*?<\/plist>/);
  if (!m) return null;
  const xml = m[0];
  const get = (key) => {
    const r = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`);
    const x = xml.match(r);
    return x ? x[1].trim() : '';
  };
  return { udid: get('UDID'), product: get('PRODUCT'), version: get('VERSION') };
}

function resultPage(info) {
  return `<!doctype html>
<html lang="km"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>UDID របស់អ្នក</title>
<style>
  body{margin:0;font-family:-apple-system,"Khmer OS",system-ui,sans-serif;background:#f2f4f8;color:#1c1e21;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
  .card{background:#fff;max-width:440px;width:100%;border-radius:20px;padding:28px 22px;box-shadow:0 8px 30px rgba(0,0,0,.08);text-align:center}
  h1{font-size:22px;margin:0 0 6px}
  p{color:#5f6672;margin:4px 0 18px;font-size:14px}
  .udid{font-family:ui-monospace,Menlo,monospace;font-size:15px;word-break:break-all;background:#f2f4f8;border-radius:12px;padding:14px;user-select:all}
  button{margin-top:16px;width:100%;padding:14px;border:0;border-radius:12px;background:#0a84ff;color:#fff;font-size:16px;font-weight:600}
  .meta{margin-top:16px;font-size:13px;color:#5f6672}
  a{color:#0a84ff}
</style></head><body><div class="card">
<h1>✅ UDID របស់អ្នក</h1>
<p>ចុចប៊ូតុងខាងក្រោមដើម្បីចម្លង</p>
<div class="udid" id="udid">${esc(info.udid)}</div>
<button onclick="copyIt()" id="btn">ចម្លង UDID</button>
<div class="meta">${esc(info.product)} · iOS ${esc(info.version)}</div>
<div class="meta"><a href="/">← ត្រឡប់ក្រោយ</a></div>
</div>
<script>
function copyIt(){
  var t=document.getElementById('udid').textContent;
  var b=document.getElementById('btn');
  function ok(){b.textContent='បានចម្លងហើយ ✓'}
  if(navigator.clipboard){navigator.clipboard.writeText(t).then(ok)}
  else{var r=document.createRange();r.selectNode(document.getElementById('udid'));var s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand('copy');ok()}
}
</script></body></html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }

  if (req.method === 'GET' && url.pathname === '/profile.mobileconfig') {
    res.writeHead(200, {
      'Content-Type': 'application/x-apple-aspen-config',
      'Content-Disposition': 'attachment; filename="udid.mobileconfig"',
    });
    return res.end(buildProfile(req));
  }

  if (req.method === 'POST' && url.pathname === '/enroll') {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1024 * 256) req.destroy();
      else chunks.push(c);
    });
    req.on('end', () => {
      const info = parseEnrollBody(Buffer.concat(chunks));
      if (!info || !/^[0-9A-Fa-f-]{20,40}$/.test(info.udid)) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Invalid request');
      }
      const q = new URLSearchParams(info).toString();
      // iOS requires HTTP 301 to open the result page in Safari
      res.writeHead(301, { Location: `${baseUrl(req)}/result?${q}` });
      res.end();
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/result') {
    const info = {
      udid: url.searchParams.get('udid') || '',
      product: url.searchParams.get('product') || '',
      version: url.searchParams.get('version') || '',
    };
    if (!/^[0-9A-Fa-f-]{20,40}$/.test(info.udid)) {
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(resultPage(info));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => console.log(`UDID Finder running on port ${PORT}`));
