// Runs the promotion website on your computer with a pretend Google Sheet, for testing.
//   node tools/local_server.js        then open http://localhost:8099/  and  http://localhost:8099/hub.html
// The Apps Script code (apps-script/Code.gs) runs here unchanged against an in-memory sheet.
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PORT = +process.env.PORT || 8099;

// ---------------------------------------------------------------- pretend Google services
function makeSheet(name) {
  const data = [];
  const noop = new Proxy({}, { get: () => () => noop });
  const sh = {
    name, data,
    getLastRow: () => data.length,
    getLastColumn: () => data.reduce((m, r) => Math.max(m, r.length), 0),
    appendRow: (r) => { data.push(r.slice()); return sh; },
    deleteRow: (i) => { data.splice(i - 1, 1); return sh; },
    setFrozenRows: () => sh,
    getRange(row, col, nr = 1, nc = 1) {
      const rng = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => {
          const v = (data[row - 1 + i] || [])[col - 1 + j]; return v === undefined ? '' : v;
        })),
        setValues: (vals) => { vals.forEach((r, i) => r.forEach((v, j) => { while (data.length < row + i) data.push([]); data[row - 1 + i][col - 1 + j] = v; })); return rng; },
        setValue: (v) => rng.setValues([[v]]),
      };
      return new Proxy(rng, { get: (t, k) => (k in t ? t[k] : () => noop) });
    },
  };
  return sh;
}
const sheets = {};
const props = {};
const mails = [];
const ctx = {
  console,
  SpreadsheetApp: {
    getActive: () => ({
      getSheetByName: (n) => sheets[n] || null,
      insertSheet: (n) => (sheets[n] = makeSheet(n)),
      getSheets: () => Object.values(sheets),
      deleteSheet: (s) => delete sheets[s.name],
      getUrl: () => 'https://docs.google.com/spreadsheets/d/test',
    }),
  },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ body: s, setMimeType() { return this; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: (k) => { delete props[k]; } }) },
  Session: { getScriptTimeZone: () => 'Asia/Kolkata', getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
  Utilities: { formatDate: (d) => new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10), base64Decode: (b) => Array.from(Buffer.from(b, 'base64')), newBlob: (bytes, mime, name) => ({ bytes, mime, name }) },
  MailApp: { sendEmail: (to, subject, body) => { mails.push({ to, subject, body }); console.log('[mail]', subject); } },
  ScriptApp: {},
  DriveApp: (() => {
    const files = {}; let n = 0;
    const file = (id) => ({ getId: () => id, setSharing() {}, setTrashed() { delete files[id]; } });
    return {
      Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 }, files,
      createFolder: () => ({ getId: () => 'folder1', createFile: (b) => { const id = 'file' + (++n); files[id] = b; return file(id); } }),
      getFolderById: (id) => ({ getId: () => id, createFile: (b) => { const id2 = 'file' + (++n); files[id2] = b; return file(id2); } }),
      getFileById: (id) => file(id),
    };
  })(),
  Date, JSON, Math, String, Number, Array, Object, parseInt, isNaN,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/Code.gs'), 'utf8'), ctx);
ctx.setup();

const api = (body) => JSON.parse(ctx.doPost({ postData: { contents: body } }).body);

// ---------------------------------------------------------------- web server
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api') {
    if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(JSON.parse(ctx.doGet().body))); }
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      // a real browser would send the user agent inside the body; tests may leave it out
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(api(b)));
    });
    return;
  }
  if (u.pathname === '/__mails') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(mails)); }
  if (u.pathname === '/__sheet') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(Object.fromEntries(Object.entries(sheets).map(([k, v]) => [k, v.data])))); }
  let p = path.join(ROOT, 'site', decodeURIComponent(u.pathname));
  if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p) && fs.existsSync(p + '.html')) p += '.html';
  if (!p.startsWith(path.join(ROOT, 'site')) || !fs.existsSync(p)) { res.writeHead(404); return res.end('not found'); }
  let data = fs.readFileSync(p);
  // point the pages at this pretend backend
  if (p.endsWith('config.js')) data = Buffer.from(String(data).replace(/API_URL:\s*'[^']*'/, "API_URL: '/api'"));
  if (p.endsWith('.html')) data = Buffer.from(String(data).replace(/__SITE__/g, `http://localhost:${PORT}`));
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  res.end(data);
});
server.listen(PORT, () => console.log(`DigiCart promotion (test copy): http://localhost:${PORT}/  ·  hub: http://localhost:${PORT}/hub.html`));
