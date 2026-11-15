/**
 * DigiCart Promotion: the Google Sheet backend.
 *
 * Paste this whole file into Extensions → Apps Script of a new Google Sheet, run setup() once,
 * then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * Copy the web app URL into config.js of the promotion website.
 *
 * Tabs it keeps:
 *   Shops     one row per shop (or per visitor of a general link): who, sent, opened, steps, taps
 *   Events    the activity log (opened, language, demo step, call/WhatsApp/download taps)
 *   Settings  phone number, Play Store link, offer, trial days, plan prices, email alerts
 *   Media     photos and videos you add from the hub (files saved in Drive folder "DigiCart Promotion Media")
 *   Shop photos you snap in the hub go to "DigiCart Promotion Media/Shop photos"; Google reads the
 *   shop name and phone number off the signboard (Drive OCR), so you only check and save.
 *
 * Every request is a POST with a JSON text body (no custom headers, so browsers can call it
 * from any website). Admin requests carry the passcode in the body as "p".
 */

var SHOP_COLS = ['id', 'name', 'phone', 'cat', 'area', 'stage', 'notes', 'followUp', 'source', 'createdAt', 'sentAt',
  'opens', 'firstOpenAt', 'lastSeenAt', 'lang', 'catChosen', 'steps', 'maxStep', 'actions', 'sec', 'device', 'anon', 'alerted', 'photo'];
var SHOP_HEAD = ['ID', 'Shop name', 'Phone', 'Category', 'Area', 'Stage', 'Notes', 'Follow-up', 'Source', 'Added', 'Sent',
  'Opens', 'First opened', 'Last seen', 'Language', 'Category tapped', 'Demo steps seen', 'Furthest step', 'Taps', 'Seconds on page',
  'Phone model', 'General-link visitor', 'Alerts sent', 'Shop photo (Drive file)'];
var DATE_COLS = ['createdAt', 'sentAt', 'firstOpenAt', 'lastSeenAt'];
var EVENT_HEAD = ['Time', 'Shop ID', 'Shop name', 'What', 'Value', 'Source'];
var MEDIA_COLS = ['id', 'type', 'name', 'price', 'mrp', 'chip', 'cat', 'fileId', 'url', 'demo', 'createdAt', 'size'];
var MEDIA_HEAD = ['ID', 'Type', 'Name', 'Price', 'MRP', 'Section', 'Category', 'Drive file', 'Link', 'Show in demo', 'Added', 'Size (KB)'];
var CHIPS = ['women', 'men', 'kids', 'ethnic', 'footwear', 'acc'];
var TYPES = ['open', 'lang', 'cat', 'step', 'action', 'ping', 'video'];
var CATS = ['grocery', 'vegetables', 'supermart', 'fashion', 'electronics', 'gifts', 'kirana', 'footwear', 'laundry', 'hardware'];
var STAGES = ['', 'interested', 'followup', 'onboarded', 'no'];
var HOT = ['call', 'whatsapp', 'setup', 'play'];
var SETTINGS = [
  ['phone', '9535388375', 'Your phone number (10 digits) for Call and WhatsApp buttons'],
  ['ownerName', 'Pradeep', 'Your name, used in messages'],
  ['playUrl', 'https://play.google.com/store/apps/details?id=com.digifactorylabs.digicart', 'Google Play link of DigiCart'],
  ['siteUrl', '', 'Web address of the promotion website (filled in automatically the first time you open the hub)'],
  ['offerOn', 'yes', 'yes = show the festival offer, no = hide it'],
  ['offerTitle', 'Diwali offer', 'Name of the offer'],
  ['offerPct', '40', 'Discount in percent on the yearly plan'],
  ['offerUntil', '2026-11-20', 'Last day of the offer (YYYY-MM-DD). After this day it hides itself'],
  ['trialDays', '15', 'Free trial days'],
  ['price3', '1529', 'Price of the 3-month plan (₹)'],
  ['price6', '3529', 'Price of the 6-month plan (₹)'],
  ['price12', '6429', 'Price of the 1-year plan (₹)'],
  ['alerts', 'yes', 'yes = email me when a shop opens the demo or taps Call / WhatsApp / setup / Download'],
  ['alertTo', '', 'Email for alerts (empty = the Google account that owns this sheet)'],
];

// ------------------------------------------------------------------ setup
function setup() {
  var ss = SpreadsheetApp.getActive();
  var sh = sheet_('Shops', SHOP_HEAD);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, SHOP_HEAD.length).setFontWeight('bold').setBackground('#0A3F86').setFontColor('#ffffff');
  sh.getRange(1, SHOP_COLS.indexOf('followUp') + 1, 1000, 1).setNumberFormat('@');
  sh.getRange(1, SHOP_COLS.indexOf('phone') + 1, 1000, 1).setNumberFormat('@');
  var ev = sheet_('Events', EVENT_HEAD);
  ev.setFrozenRows(1);
  ev.getRange(1, 1, 1, EVENT_HEAD.length).setFontWeight('bold').setBackground('#0A3F86').setFontColor('#ffffff');
  var md = sheet_('Media', MEDIA_HEAD);
  md.setFrozenRows(1);
  md.getRange(1, 1, 1, MEDIA_HEAD.length).setFontWeight('bold').setBackground('#0A3F86').setFontColor('#ffffff');
  mediaFolder_();
  var st = sheet_('Settings', ['Setting', 'Value', 'What it is']);
  st.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#0A3F86').setFontColor('#ffffff');
  st.getRange(1, 2, 100, 1).setNumberFormat('@');
  var have = settings_();
  SETTINGS.forEach(function (s) { if (!(s[0] in have.raw)) st.appendRow([s[0], s[1], s[2]]); });
  var first = ss.getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  return 'DigiCart Promotion sheet is ready. Now Deploy → New deployment → Web app.';
}

function sheet_(name, head) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(head);
  return sh;
}

// ------------------------------------------------------------------ http
function doGet() {
  return json_({ ok: true, app: 'DigiCart Promotion', time: Date.now() });
}

function doPost(e) {
  var b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ error: 'bad request' }); }
  try {
    if (b.a === 'e') return json_(event_(b));
    if (b.a === 'cfg') return json_(publicSettings_(settings_()));
    if (!checkPass_(b.p)) return json_({ error: 'Wrong passcode', auth: false });
    if (b.a === 'admin') return json_(adminData_(b));
    if (b.a === 'snap') return json_(snap_(b));
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (b.a === 'add') return json_(addShops_(b.shops));
      if (b.a === 'upd') return json_(updShop_(b.id, b.f || {}));
      if (b.a === 'del') return json_(delShop_(b.id));
      if (b.a === 'set') return json_(saveSettings_(b.set || {}));
      if (b.a === 'pass') return json_(changePass_(b.np));
      if (b.a === 'up') return json_(upload_(b));
      if (b.a === 'mlink') return json_(addLink_(b));
      if (b.a === 'mupd') return json_(updMedia_(b.id, b.f || {}));
      if (b.a === 'mdel') return json_(delMedia_(b.id));
    } finally { lock.releaseLock(); }
    return json_({ error: 'unknown action' });
  } catch (x) {
    console.error(x);
    return json_({ error: 'Server error: ' + x });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------------ helpers
function clean_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n); }
function phone10_(p) { return String(p || '').replace(/\D/g, '').slice(-10); }
function newId_() {
  var abc = 'abcdefghijkmnpqrstuvwxyz23456789', s = '';
  for (var i = 0; i < 8; i++) s += abc.charAt(Math.floor(Math.random() * abc.length));
  return s;
}
function ms_(v) { return v instanceof Date ? v.getTime() : (Number(v) || 0); }
function day_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
  return clean_(v, 10);
}
function list_(v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(String); }

function deviceOf_(ua) {
  var s = String(ua || '');
  var m = /Android ([\d.]+);\s*([^;)]+)/.exec(s);
  if (m) return clean_('Android ' + m[1].split('.')[0] + ' · ' + m[2].replace(/Build.*/, '').trim(), 60);
  if (/iPhone/.test(s)) return 'iPhone';
  if (/iPad/.test(s)) return 'iPad';
  if (/Windows/.test(s)) return 'Windows PC';
  if (/Macintosh/.test(s)) return 'Mac';
  return clean_(s.split(' ')[0], 40);
}

/** All shop rows as objects, plus a way to write a row back. */
function shops_() {
  var sh = sheet_('Shops', SHOP_HEAD);
  if (sh.getLastColumn() < SHOP_HEAD.length) sh.getRange(1, 1, 1, SHOP_HEAD.length).setValues([SHOP_HEAD]);
  var vals = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, SHOP_COLS.length).getValues() : [];
  var rows = vals.map(function (r, i) {
    var o = { _row: i + 2 };
    SHOP_COLS.forEach(function (k, j) { o[k] = r[j]; });
    return o;
  });
  return { sh: sh, rows: rows };
}
function rowOf_(o) {
  return SHOP_COLS.map(function (k) {
    var v = o[k];
    if (DATE_COLS.indexOf(k) >= 0) return v ? (v instanceof Date ? v : new Date(ms_(v))) : '';
    if (k === 'anon') return v ? 'yes' : '';
    return v == null ? '' : v;
  });
}
function writeShop_(sh, o) {
  if (o._row) sh.getRange(o._row, 1, 1, SHOP_COLS.length).setValues([rowOf_(o)]);
  else sh.appendRow(rowOf_(o));
}
function publicShop_(o) {
  return {
    id: String(o.id), name: String(o.name || ''), phone: String(o.phone || ''), cat: String(o.cat || ''), area: String(o.area || ''),
    stage: String(o.stage || ''), notes: String(o.notes || ''), followUp: day_(o.followUp), source: String(o.source || ''),
    createdAt: ms_(o.createdAt), sentAt: ms_(o.sentAt), opens: Number(o.opens) || 0, firstOpenAt: ms_(o.firstOpenAt),
    lastSeenAt: ms_(o.lastSeenAt), lang: String(o.lang || ''), catChosen: String(o.catChosen || ''),
    steps: list_(o.steps).map(Number), maxStep: Number(o.maxStep) || 0, actions: list_(o.actions), sec: Number(o.sec) || 0,
    device: String(o.device || ''), anon: o.anon === true || o.anon === 'yes', photo: String(o.photo || ''),
  };
}

// ------------------------------------------------------------------ settings
function settings_() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Settings');
  var raw = {};
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      if (r[0]) raw[String(r[0]).trim()] = r[1] instanceof Date ? day_(r[1]) : String(r[1]).trim();
    });
  }
  var s = {};
  SETTINGS.forEach(function (d) { s[d[0]] = d[0] in raw ? raw[d[0]] : d[1]; });
  s.raw = raw;
  return s;
}
function publicSettings_(s) {
  var until = s.offerUntil;
  var live = /^yes$/i.test(s.offerOn) && Number(s.offerPct) > 0 && Number(s.offerPct) < 100;
  if (live && /^\d{4}-\d{2}-\d{2}$/.test(until)) {
    var end = new Date(until + 'T23:59:59+05:30').getTime();
    if (Date.now() > end) live = false;
  }
  return {
    phone: phone10_(s.phone) || '9535388375', ownerName: s.ownerName, playUrl: s.playUrl,
    trialDays: Number(s.trialDays) || 15,
    plans: [{ id: 'plan-3m', months: 3, price: Number(s.price3) || 1529 }, { id: 'plan-6m', months: 6, price: Number(s.price6) || 3529 },
      { id: 'plan-12m', months: 12, price: Number(s.price12) || 6429 }],
    festival: { enabled: live, title: s.offerTitle || 'Festival offer', pct: Number(s.offerPct) || 0, until: until, plans: ['plan-12m'] },
  };
}
function saveSettings_(set) {
  var sh = sheet_('Settings', ['Setting', 'Value', 'What it is']);
  var vals = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  SETTINGS.forEach(function (d) {
    if (!(d[0] in set)) return;
    var v = clean_(set[d[0]], 300);
    var i = -1;
    vals.forEach(function (r, j) { if (String(r[0]).trim() === d[0]) i = j; });
    if (i >= 0) sh.getRange(i + 2, 2).setValue(v);
    else { sh.appendRow([d[0], v, d[2]]); vals.push([d[0]]); }
  });
  return { ok: true, settings: settingsOut_() };
}
function settingsOut_() {
  var s = settings_();
  var o = {};
  SETTINGS.forEach(function (d) { o[d[0]] = s[d[0]]; });
  return o;
}

// ------------------------------------------------------------------ passcode
function checkPass_(p) {
  p = clean_(p, 64);
  if (p.length < 6) return false;
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('PASS');
  if (!saved) { props.setProperty('PASS', p); return true; }
  return saved === p;
}
function changePass_(np) {
  np = clean_(np, 64);
  if (np.length < 6) return { error: 'Use at least 6 characters' };
  PropertiesService.getScriptProperties().setProperty('PASS', np);
  return { ok: true };
}
/** Run this from the editor if you forget the passcode; the next passcode typed in the hub becomes the new one. */
function resetPasscode() { PropertiesService.getScriptProperties().deleteProperty('PASS'); return 'Passcode cleared'; }

// ------------------------------------------------------------------ public event from the demo page
function event_(b) {
  var t = clean_(b.t, 10);
  var d = clean_(b.d, 24).toLowerCase();
  var r = clean_(b.r, 12).toLowerCase();
  if (TYPES.indexOf(t) < 0 || !/^[a-z0-9]{8,24}$/.test(d)) return { error: 'bad event' };
  if (r && !/^[a-z0-9]{6,12}$/.test(r)) r = '';
  var v = clean_(b.v, 40);
  var s = Math.max(0, Math.min(7200, Math.round(Number(b.s) || 0)));
  var src = clean_(b.src, 20).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  var c = clean_(b.c, 12);
  var now = new Date();

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var cur, sh, isNew = false;
  try {
    var all = shops_();
    sh = all.sh;
    cur = r ? find_(all.rows, r) : null;
    if (!cur) {
      cur = find_(all.rows, 'a_' + d);
      if (!cur) {
        isNew = true;
        cur = { id: 'a_' + d, name: '', phone: '', cat: CATS.indexOf(c) >= 0 ? c : '', area: '', anon: true, createdAt: now, source: src || 'link', opens: 0 };
      }
    }
    if (t === 'ping') {
      if (!isNew) {
        var colSec = SHOP_COLS.indexOf('sec') + 1, colSeen = SHOP_COLS.indexOf('lastSeenAt') + 1;
        if (s > (Number(cur.sec) || 0)) sh.getRange(cur._row, colSec).setValue(s);
        sh.getRange(cur._row, colSeen).setValue(now);
      }
      return { ok: true };
    }
    cur.lastSeenAt = now;
    if (s > (Number(cur.sec) || 0)) cur.sec = s;
    var alert = '';
    if (t === 'open') {
      cur.opens = (Number(cur.opens) || 0) + 1;
      if (!cur.firstOpenAt) { cur.firstOpenAt = now; alert = 'open'; }
      cur.device = deviceOf_(b.ua);
      if (src && !cur.source) cur.source = src;
    } else if (t === 'lang') cur.lang = v;
    else if (t === 'cat') cur.catChosen = v;
    else if (t === 'step') {
      var n = Math.max(0, Math.min(50, parseInt(v, 10) || 0));
      var steps = list_(cur.steps).map(Number);
      if (steps.indexOf(n) < 0) steps.push(n);
      steps.sort(function (a, x) { return a - x; });
      cur.steps = steps.join(',');
      cur.maxStep = Math.max(Number(cur.maxStep) || 0, n);
    } else if (t === 'action' || t === 'video') {
      var a = t === 'video' ? 'video' : v;
      var acts = list_(cur.actions);
      if (acts.indexOf(a) < 0) { acts.push(a); if (HOT.indexOf(a) >= 0) alert = a; }
      cur.actions = acts.slice(0, 20).join(',');
    }
    var sent = list_(cur.alerted);
    var doAlert = alert && sent.indexOf(alert) < 0;
    if (doAlert) { sent.push(alert); cur.alerted = sent.join(','); }
    writeShop_(sh, cur);
    sheet_('Events', EVENT_HEAD).appendRow([now, cur.id, cur.name || 'New visitor', t, v, cur.source || '']);
  } finally { lock.releaseLock(); }

  if (doAlert) { try { mailAlert_(cur, alert); } catch (x) { console.error('mail', x); } }
  if (t === 'open') {
    var out = publicSettings_(settings_());
    out.ok = true; out.name = String(cur.name || ''); out.area = String(cur.area || ''); out.cat = String(cur.cat || '');
    out.media = media_().rows.map(publicMedia_).filter(function (m) { return m.demo; });
    return out;
  }
  return { ok: true };
}
function find_(rows, id) {
  for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === id) return rows[i];
  return null;
}

// ------------------------------------------------------------------ admin
function adminData_(b) {
  var s = settings_();
  if (b.site && !s.siteUrl) saveSettings_({ siteUrl: b.site });
  var shops = shops_().rows.map(publicShop_);
  var ev = sheet_('Events', EVENT_HEAD);
  var n = Math.min(150, Math.max(0, ev.getLastRow() - 1));
  var events = n ? ev.getRange(ev.getLastRow() - n + 1, 1, n, EVENT_HEAD.length).getValues().reverse().map(function (r) {
    return { at: ms_(r[0]), id: String(r[1]), name: String(r[2]), t: String(r[3]), v: String(r[4]), src: String(r[5]) };
  }) : [];
  return { shops: shops, events: events, settings: settingsOut_(), media: media_().rows.map(publicMedia_), sheetUrl: SpreadsheetApp.getActive().getUrl(), now: Date.now() };
}
function addShops_(list) {
  list = Array.isArray(list) ? list.slice(0, 500) : [];
  var all = shops_();
  var have = {};
  all.rows.forEach(function (o) { if (o.phone) have[String(o.phone)] = o; });
  var added = [], skipped = 0;
  list.forEach(function (x) {
    var name = clean_(x.name, 60), ph = phone10_(x.phone);
    if (!name && ph.length !== 10) return;
    if (ph.length === 10 && have[ph]) { skipped++; return; }
    var o = { id: newId_(), name: name || ('Shop ' + ph.slice(-4)), phone: ph.length === 10 ? ph : '', cat: CATS.indexOf(clean_(x.cat, 12)) >= 0 ? clean_(x.cat, 12) : 'fashion',
      area: clean_(x.area, 40), createdAt: new Date(), opens: 0, anon: false, source: x.photo ? 'visit' : 'personal', notes: clean_(x.notes, 200),
      photo: fileId_(x.photo) };
    writeShop_(all.sh, o);
    if (ph) have[ph] = o;
    added.push(publicShop_(o));
  });
  return { added: added, skipped: skipped };
}
function updShop_(id, f) {
  var all = shops_();
  var o = find_(all.rows, clean_(id, 40));
  if (!o) return { error: 'Shop not found' };
  if ('stage' in f && STAGES.indexOf(f.stage) >= 0) o.stage = f.stage;
  if ('notes' in f) o.notes = clean_(f.notes, 500);
  if ('followUp' in f) o.followUp = /^\d{4}-\d{2}-\d{2}$/.test(f.followUp) ? f.followUp : '';
  if ('name' in f && clean_(f.name, 60)) o.name = clean_(f.name, 60);
  if ('phone' in f) o.phone = phone10_(f.phone).length === 10 ? phone10_(f.phone) : '';
  if ('area' in f) o.area = clean_(f.area, 40);
  if ('cat' in f && CATS.indexOf(f.cat) >= 0) o.cat = f.cat;
  if ('photo' in f) o.photo = fileId_(f.photo);
  if (f.sent) o.sentAt = new Date();
  if (f.claim) { o.anon = false; }
  writeShop_(all.sh, o);
  return { ok: true, shop: publicShop_(o) };
}
function delShop_(id) {
  var all = shops_();
  var o = find_(all.rows, clean_(id, 40));
  if (o) all.sh.deleteRow(o._row);
  return { ok: true };
}

// ------------------------------------------------------------------ email alerts
function mailAlert_(o, what) {
  var s = settings_();
  if (!/^yes$/i.test(s.alerts)) return;
  var to = s.alertTo || Session.getEffectiveUser().getEmail();
  if (!to) return;
  var who = o.name || 'A new visitor';
  var map = { open: 'opened your DigiCart demo', call: 'tapped CALL', whatsapp: 'tapped WHATSAPP', setup: 'asked for FREE SETUP', play: 'tapped DOWNLOAD (Google Play)' };
  var subject = (what === 'open' ? '👀 ' : '🔥 ') + who + ' ' + (map[what] || what);
  var lines = [
    who + ' ' + (map[what] || what) + '.',
    '',
    o.phone ? 'Phone: +91 ' + o.phone + '   (WhatsApp: https://wa.me/91' + o.phone + ')' : 'Phone: not known (general link)',
    o.area ? 'Area: ' + o.area : '',
    'Demo steps seen: ' + (list_(o.steps).join(', ') || 'none yet'),
    'Phone model: ' + (o.device || ''),
    '',
    s.siteUrl ? 'Live tracker: ' + s.siteUrl.replace(/\/?$/, '/') + 'hub.html' : '',
  ].filter(function (x, i, a) { return x !== '' || (a[i - 1] !== ''); });
  MailApp.sendEmail(to, subject, lines.join('\n'));
}

/** Evening summary email. Run installDailySummary() once to get it every day at about 9 pm. */
function dailySummary() {
  var shops = shops_().rows.map(publicShop_);
  var since = Date.now() - 24 * 3600 * 1000;
  var opened = shops.filter(function (x) { return x.lastSeenAt > since; });
  var hot = shops.filter(function (x) { return x.actions.some(function (a) { return HOT.indexOf(a) >= 0; }); });
  var s = settings_();
  var to = s.alertTo || Session.getEffectiveUser().getEmail();
  var body = ['DigiCart promotion, last 24 hours', '',
    'Shops in the list: ' + shops.filter(function (x) { return !x.anon; }).length,
    'Sent so far: ' + shops.filter(function (x) { return x.sentAt; }).length,
    'Active today: ' + opened.length, 'Hot leads (all time): ' + hot.length, ''];
  opened.forEach(function (x) {
    body.push('• ' + (x.name || 'New visitor') + (x.phone ? ' (+91 ' + x.phone + ')' : '') + ': furthest step ' + x.maxStep + (x.actions.length ? ', tapped ' + x.actions.join('/') : ''));
  });
  var due = shops.filter(function (x) { return x.followUp && x.followUp <= day_(new Date()); });
  if (due.length) { body.push('', 'Follow up today:'); due.forEach(function (x) { body.push('• ' + x.name + (x.phone ? ' +91 ' + x.phone : '')); }); }
  if (s.siteUrl) body.push('', 'Open the hub: ' + s.siteUrl.replace(/\/?$/, '/') + 'hub.html');
  if (to) MailApp.sendEmail(to, '📊 DigiCart promotion: ' + opened.length + ' active, ' + hot.length + ' hot', body.join('\n'));
}
function installDailySummary() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'dailySummary') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailySummary').timeBased().everyDays(1).atHour(21).create();
  return 'Daily summary set for about 9 pm';
}

// ------------------------------------------------------------------ photos and videos (hub → Drive)
function mediaFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('MEDIA_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) {} }
  var f = DriveApp.createFolder('DigiCart Promotion Media');
  props.setProperty('MEDIA_FOLDER', f.getId());
  return f;
}
function media_() {
  var sh = sheet_('Media', MEDIA_HEAD);
  var vals = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, MEDIA_COLS.length).getValues() : [];
  return { sh: sh, rows: vals.map(function (r, i) { var o = { _row: i + 2 }; MEDIA_COLS.forEach(function (k, j) { o[k] = r[j]; }); return o; }) };
}
function mediaRow_(o) {
  return MEDIA_COLS.map(function (k) {
    if (k === 'createdAt') return o.createdAt ? (o.createdAt instanceof Date ? o.createdAt : new Date(ms_(o.createdAt))) : '';
    if (k === 'demo') return o.demo ? 'yes' : '';
    return o[k] == null ? '' : o[k];
  });
}
function publicMedia_(o) {
  var fid = String(o.fileId || '');
  var type = String(o.type || 'photo');
  var url = String(o.url || '');
  var yt = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/.exec(url);
  return {
    id: String(o.id), type: type, name: String(o.name || ''), price: Number(o.price) || 0, mrp: Number(o.mrp) || 0,
    chip: String(o.chip || ''), cat: String(o.cat || 'fashion'), demo: o.demo === true || o.demo === 'yes',
    createdAt: ms_(o.createdAt), size: Number(o.size) || 0,
    view: fid ? (type === 'photo' ? 'https://drive.google.com/thumbnail?id=' + fid + '&sz=w1000' : 'https://drive.google.com/file/d/' + fid + '/preview')
      : yt ? 'https://www.youtube.com/embed/' + yt[1] : url,
    thumb: fid ? 'https://drive.google.com/thumbnail?id=' + fid + '&sz=w600' : yt ? 'https://i.ytimg.com/vi/' + yt[1] + '/hqdefault.jpg' : '',
    open: fid ? 'https://drive.google.com/file/d/' + fid + '/view' : url,
    download: fid ? 'https://drive.google.com/uc?export=download&id=' + fid : url,
  };
}
function upload_(b) {
  var mime = clean_(b.mime, 60);
  var type = /^video\//.test(mime) ? 'video' : /^image\//.test(mime) ? 'photo' : '';
  if (!type) return { error: 'Only photos and videos' };
  var bytes = Utilities.base64Decode(String(b.data || ''));
  if (!bytes.length) return { error: 'Empty file' };
  var name = clean_(b.name, 60) || (type === 'photo' ? 'New arrival' : 'Video');
  var blob = Utilities.newBlob(bytes, mime, clean_(b.file, 80) || (name + (type === 'photo' ? '.jpg' : '.mp4')));
  var file = mediaFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var o = { id: newId_(), type: type, name: name, price: Math.max(0, Math.round(Number(b.price) || 0)), mrp: Math.max(0, Math.round(Number(b.mrp) || 0)),
    chip: /^[a-z]{2,12}$/.test(String(b.chip || '')) ? b.chip : '', cat: CATS.indexOf(b.cat) >= 0 ? b.cat : 'fashion', fileId: file.getId(), url: '',
    demo: b.demo !== false, createdAt: new Date(), size: Math.round(bytes.length / 1024) };
  sheet_('Media', MEDIA_HEAD).appendRow(mediaRow_(o));
  return { ok: true, item: publicMedia_(o) };
}
// ------------------------------------------------------------------ shop photo: save it and read the signboard
function fileId_(v) { v = String(v || ''); return /^[\w-]{10,100}$/.test(v) ? v : ''; }
function shopFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHOP_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) {} }
  var f = mediaFolder_().createFolder('Shop photos');
  props.setProperty('SHOP_FOLDER', f.getId());
  return f;
}
/** Saves the shop photo in Drive and returns the text Google reads on it (signboard name, phone numbers). */
function snap_(b) {
  var bytes = Utilities.base64Decode(String(b.data || ''));
  if (!bytes.length) return { error: 'Empty photo' };
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd HH.mm');
  var file = shopFolder_().createFile(Utilities.newBlob(bytes, 'image/jpeg', 'Shop ' + stamp + '.jpg'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var out = { ok: true, fileId: file.getId(), text: '' };
  if (b.read === false) return out;
  try { out.text = ocr_(bytes); } catch (x) { console.error('ocr', x); out.ocrError = String(x).slice(0, 200); }
  return out;
}
/** Google Drive OCR: upload the photo as a Google Doc, read its text, delete the Doc. */
function ocr_(bytes) {
  var token = ScriptApp.getOAuthToken(), auth = { Authorization: 'Bearer ' + token };
  var bound = 'dcsnap' + Date.now();
  var meta = { name: 'shop-ocr-tmp', mimeType: 'application/vnd.google-apps.document', parents: [shopFolder_().getId()] };
  var head = '--' + bound + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
    '\r\n--' + bound + '\r\nContent-Type: image/jpeg\r\n\r\n';
  var payload = Utilities.newBlob(head).getBytes().concat(bytes).concat(Utilities.newBlob('\r\n--' + bound + '--').getBytes());
  var r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'post', contentType: 'multipart/related; boundary=' + bound, payload: payload, headers: auth, muteHttpExceptions: true });
  if (r.getResponseCode() >= 300) throw new Error('read ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 150));
  var docId = JSON.parse(r.getContentText()).id;
  try {
    var t = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + docId + '/export?mimeType=text/plain', { headers: auth, muteHttpExceptions: true });
    return t.getResponseCode() < 300 ? t.getContentText().replace(/^\uFEFF/, '').slice(0, 3000) : '';
  } finally {
    try { DriveApp.getFileById(docId).setTrashed(true); } catch (x) {}
  }
}
/** Run once from the editor after pasting this version: it asks Google for the one new permission (reading shop photos). */
function allowShopPhotos() {
  shopFolder_();
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  return 'Shop photos are ready';
}

function addLink_(b) {
  var url = clean_(b.url, 300);
  if (!/^https:\/\//.test(url)) return { error: 'Paste a full link starting with https://' };
  var o = { id: newId_(), type: 'video', name: clean_(b.name, 60) || 'Video', chip: '', cat: CATS.indexOf(b.cat) >= 0 ? b.cat : 'fashion',
    fileId: '', url: url, demo: b.demo !== false, createdAt: new Date(), size: 0 };
  sheet_('Media', MEDIA_HEAD).appendRow(mediaRow_(o));
  return { ok: true, item: publicMedia_(o) };
}
function updMedia_(id, f) {
  var all = media_(), o = null;
  all.rows.forEach(function (r) { if (String(r.id) === String(id)) o = r; });
  if (!o) return { error: 'Not found' };
  if ('name' in f) o.name = clean_(f.name, 60);
  if ('price' in f) o.price = Math.max(0, Math.round(Number(f.price) || 0));
  if ('mrp' in f) o.mrp = Math.max(0, Math.round(Number(f.mrp) || 0));
  if ('chip' in f) o.chip = /^[a-z]{2,12}$/.test(String(f.chip || '')) ? f.chip : '';
  if ('demo' in f) o.demo = !!f.demo;
  all.sh.getRange(o._row, 1, 1, MEDIA_COLS.length).setValues([mediaRow_(o)]);
  return { ok: true, item: publicMedia_(o) };
}
function delMedia_(id) {
  var all = media_(), o = null;
  all.rows.forEach(function (r) { if (String(r.id) === String(id)) o = r; });
  if (!o) return { ok: true };
  if (o.fileId) { try { DriveApp.getFileById(String(o.fileId)).setTrashed(true); } catch (x) {} }
  all.sh.deleteRow(o._row);
  return { ok: true };
}
