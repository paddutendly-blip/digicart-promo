// Quick checks of apps-script/Code.gs against the pretend sheet:  node tools/test_backend.js
process.env.PORT = 8098;
const assert = require('assert');
const port = 8098;
require('./local_server.js');
const call = (o) => fetch(`http://localhost:${port}/api`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(o) }).then((r) => r.json());
(async () => {
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual((await call({ a: 'admin', p: '123' })).auth, false);
  const P = 'digi2026';
  assert.ok((await call({ a: 'admin', p: P })).shops);
  assert.strictEqual((await call({ a: 'admin', p: 'other99' })).auth, false);
  const add = await call({ a: 'add', p: P, shops: [{ name: 'Sri Lakshmi Fashions', phone: '+91 98450 12345', area: 'Peenya', cat: 'fashion' }, { name: 'Dup', phone: '9845012345' }, { name: '', phone: '12' }] });
  assert.strictEqual(add.added.length, 1); assert.strictEqual(add.skipped, 1);
  const id = add.added[0].id;
  const ua = 'Mozilla/5.0 (Linux; Android 14; Redmi Note 12 Build/UKQ1) Chrome/130';
  const o = await call({ a: 'e', r: id, d: 'dev12345abc', t: 'open', s: 0, ua });
  assert.strictEqual(o.name, 'Sri Lakshmi Fashions'); assert.strictEqual(o.festival.pct, 40); assert.strictEqual(o.plans.length, 3);
  await call({ a: 'e', r: id, d: 'dev12345abc', t: 'lang', v: 'kn', s: 4 });
  await call({ a: 'e', r: id, d: 'dev12345abc', t: 'step', v: '3', s: 30 });
  await call({ a: 'e', r: id, d: 'dev12345abc', t: 'step', v: '1', s: 20 });
  await call({ a: 'e', r: id, d: 'dev12345abc', t: 'action', v: 'play', s: 60 });
  await call({ a: 'e', r: id, d: 'dev12345abc', t: 'action', v: 'play', s: 61 });
  await call({ a: 'e', r: id, d: 'dev12345abc', t: 'ping', s: 75 });
  assert.strictEqual((await call({ a: 'e', d: 'x', t: 'open' })).error, 'bad event');
  await call({ a: 'e', d: 'anonymousdev1', t: 'open', c: 'fashion', src: 'poster', ua });
  const L = await call({ a: 'admin', p: P, site: 'https://x.github.io/digicart-promo/' });
  const s = L.shops.find((x) => x.id === id);
  assert.strictEqual(s.opens, 1); assert.strictEqual(s.lang, 'kn'); assert.deepStrictEqual(s.steps, [1, 3]); assert.strictEqual(s.maxStep, 3);
  assert.deepStrictEqual(s.actions, ['play']); assert.strictEqual(s.sec, 75); assert.strictEqual(s.device, 'Android 14 · Redmi Note 12');
  const A = L.shops.find((x) => x.anon); assert.ok(A && A.cat === 'fashion' && A.source === 'poster');
  assert.strictEqual(L.events.length, 7);
  assert.strictEqual(L.events[0].t, 'open'); // newest first
  assert.strictEqual(L.settings.siteUrl, 'https://x.github.io/digicart-promo/');
  const u = await call({ a: 'upd', p: P, id, f: { stage: 'interested', notes: 'call Monday', followUp: '2026-11-16', sent: true } });
  assert.strictEqual(u.shop.stage, 'interested'); assert.ok(u.shop.sentAt); assert.strictEqual(u.shop.followUp, '2026-11-16');
  const st = await call({ a: 'set', p: P, set: { offerPct: '30', offerOn: 'no' } });
  assert.strictEqual(st.settings.offerPct, '30');
  const cfg = await call({ a: 'cfg' }); assert.strictEqual(cfg.festival.enabled, false);
  await call({ a: 'set', p: P, set: { offerOn: 'yes', offerPct: '40' } });
  await call({ a: 'del', p: P, id });
  assert.ok(!(await call({ a: 'admin', p: P })).shops.find((x) => x.id === id));
  // media
  const up = await call({ a: 'up', p: P, mime: 'image/jpeg', data: Buffer.from('fakejpeg').toString('base64'), name: 'Red kurti', price: 650, chip: 'women' });
  assert.ok(up.item && up.item.view.includes('thumbnail?id=file1') && up.item.demo);
  const lk = await call({ a: 'mlink', p: P, url: 'https://youtube.com/shorts/abcDEF12345', name: 'Shop tour' });
  assert.strictEqual(lk.item.view, 'https://www.youtube.com/embed/abcDEF12345');
  assert.strictEqual((await call({ a: 'up', p: P, mime: 'text/plain', data: 'eA==' })).error, 'Only photos and videos');
  await call({ a: 'mupd', p: P, id: lk.item.id, f: { demo: false } });
  const o2 = await call({ a: 'e', d: 'anotherdev99', t: 'open', c: 'fashion' });
  assert.strictEqual(o2.media.length, 1); assert.strictEqual(o2.media[0].name, 'Red kurti');
  await call({ a: 'mdel', p: P, id: up.item.id });
  assert.strictEqual((await call({ a: 'admin', p: P })).media.length, 1);
  const mails = await fetch(`http://localhost:${port}/__mails`).then((r) => r.json());
  assert.strictEqual(mails.length, 4); // first open, play (once), two anon opens
  console.log('backend ok', mails.map((m) => m.subject));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
