#!/usr/bin/env node
// Reproducible dev helper: fetch 12 distinct openly-licensed REAL wristwatch photos
// (one per seeded catalog product) from the Openverse API into uploads/watch-<ID>.jpg.
// Licenses accepted: cc0, pdm, by, by-sa (all allow commercial use).
//
// Commands:
//   node scripts/fetch-catalog-images.js list [id] ["optional replacement query"]
//       -> queries Openverse for product id(s) (default: all), writes .tmp-candidates/<id>.json,
//          prints condensed candidate table (number candidates for `grab`).
//   node scripts/fetch-catalog-images.js grab <id> <n>
//       -> downloads candidate #n of product id, validates (JPEG magic, >15KB, short side >=600px,
//          not a duplicate of an existing file), writes uploads/watch-<id>.jpg.
//   node scripts/fetch-catalog-images.js check
//       -> validates every uploads/watch-*.jpg + og-sabrxwatches.jpg (jpeg, bytes, dimensions, dupes).
//   node scripts/fetch-catalog-images.js og <id>
//       -> copies uploads/watch-<id>.jpg to uploads/og-sabrxwatches.jpg (social card).
//   node scripts/fetch-catalog-images.js ogurl <url>
//       -> downloads arbitrary licensed image url to uploads/og-sabrxwatches.jpg.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'uploads');
const SCRATCH = path.join(ROOT, '.tmp-candidates');

// id -> query matched against each product's described style/colors.
const PRODUCTS = [
  ['amc-32671449-0', 'black dial steel bracelet wristwatch minimal'],
  ['amc-32671636-1', 'blue dial gold wristwatch bracelet'],
  ['amc-32671803-2', 'skeleton wristwatch black leather strap'],
  ['amc-32671954-3', 'ladies gold wristwatch bracelet'],
  ['amc-32672197-4', 'two tone wristwatch white dial'],
  ['amc-32672402-5', 'wristwatch black dial leather strap'],
  ['amc-32672560-6', 'wristwatch green rubber strap'],
  ['amc-32672716-7', 'wristwatch yellow strap'],
  ['amc-32672878-8', 'minimalist white dial brown leather strap watch'],
  ['amc-32673035-9', 'black chronograph wristwatch'],
  ['amc-32673196-10', 'gold wristwatch roman numerals dial'],
  ['amc-32673356-11', 'gold skeleton watch'],
];

// reject obvious brand names in titles (product is sold "Unbranded" — dial must not read a brand)
const BRANDS = /\b(seiko|casio|citizen|omega|rolex|tudor|breitling|tag\s?heuer|tissot|hamilton|fossil|michael\s?(kors)?|mvmt|skagen|swatch|orient|skmei|samoa|titan|g-?shock|apple|samsung|galaxy|swarovski|bulova|movado|longines|mido|hublot|audemars|patek|iwc|rado|roamer|nixon|diesel|armani|guess|gucci|daniel\s?wellington|lacoste|hugo|boss|jeep|victorinox|swiss\s?military|mido|elix|angleius|pilot|invicta|michael|kors|fitbit|garmin|withings|kai|dover|zenith|montblanc|cartier|chopard|jaeger|lecoultre|panerai|bell\s?ross|bell&ross|u-boat|ollech|junghans|nomos|stowa|bauhaus)\b/i;

const UA = 'Mozilla/5.0'; // exactly — bot-ish UA suffixes get 401 from Openverse
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 6) return reject(new Error('too many redirects'));
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? require('http') : require('https');
    lib.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': UA, Referer: 'https://openverse.org/' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString(), depth + 1));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body: Buffer.concat(chunks) }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function jpegDims(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let p = 2;
  while (p < buf.length - 9) {
    if (buf[p] !== 0xff) { p++; continue; }
    const m = buf[p + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { height: buf.readUInt16BE(p + 5), width: buf.readUInt16BE(p + 7) };
    }
    p += 2 + buf.readUInt16BE(p + 2);
  }
  return { width: 0, height: 0 };
}

async function openverse(q) {
  const url = 'https://api.openverse.org/v1/images/?q=' + encodeURIComponent(q) +
    '&license=cc0,pdm,by,by-sa&page_size=25&mature=false';
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await get(url);
    if (r.status === 429) { await sleep(6000); continue; }
    if (r.status !== 200) throw new Error('openverse http ' + r.status);
    return JSON.parse(r.body.toString('utf8')).results || [];
  }
  throw new Error('openverse rate-limited');
}

async function cmdList(onlyId, overrideQ) {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const list = PRODUCTS.filter(([id]) => !onlyId || id === onlyId);
  for (const [id, defQ] of list) {
    const q = overrideQ || defQ;
    let results;
    try { results = await openverse(q); } catch (e) { console.log(id, 'ERR', e.message); continue; }
    const cands = [];
    for (const r of results) {
      const title = (r.title || '').slice(0, 70);
      if (BRANDS.test(title)) continue;
      if (!r.width || !r.height || Math.min(r.width, r.height) < 600) continue;
      cands.push({
        title, license: r.license, source: r.source, width: r.width, height: r.height,
        thumbnail: r.thumbnail, url: r.url || '', id: r.id,
      });
    }
    fs.writeFileSync(path.join(SCRATCH, id + '.json'), JSON.stringify(cands, null, 1));
    console.log('=== ' + id + '  q="' + q + '"  (' + cands.length + ' filtered candidates)');
    cands.forEach((c, i) => console.log(
      String(i + 1).padStart(2) + ' | ' + c.license.padEnd(5) + ' | ' + (c.source || '').slice(0, 12).padEnd(12) +
      ' | ' + c.width + 'x' + c.height + ' | ' + c.title));
    await sleep(2200);
  }
}

async function cmdGrab(id, n) {
  const cands = JSON.parse(fs.readFileSync(path.join(SCRATCH, id + '.json'), 'utf8'));
  const c = cands[Number(n) - 1];
  if (!c) throw new Error('no candidate #' + n + ' for ' + id);
  const dl = async (u) => {
    const f = await get(u);
    if (f.status !== 200 || f.body.length < 15000) return null;
    if (!/image\/jpeg/i.test(f.type) && !(f.body[0] === 0xff && f.body[1] === 0xd8)) return null;
    const d = jpegDims(f.body);
    if (!d || d.width < 1 || Math.min(d.width, d.height) < 600) return null;
    return { body: f.body, dims: d };
  };
  let got = await dl(c.thumbnail);
  if (!got && c.url) got = await dl(c.url); // thumbnail too small? try original
  if (!got) throw new Error('download failed / too small / not jpeg for candidate ' + n);
  // duplicate guard against every existing watch file
  const h = crypto.createHash('md5').update(got.body).digest('hex');
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^watch-.*\.jpg$/.test(f)) {
      const old = fs.readFileSync(path.join(OUT_DIR, f));
      if (crypto.createHash('md5').update(old).digest('hex') === h) throw new Error('duplicate of ' + f);
    }
  }
  const out = path.join(OUT_DIR, 'watch-' + id + '.jpg');
  fs.writeFileSync(out, got.body);
  console.log('OK watch-' + id + '.jpg', got.dims.width + 'x' + got.dims.height, got.body.length + 'B',
    '|', c.license, '|', c.source, '|', c.title);
}

async function cmdCheck() {
  const seen = {};
  const files = fs.readdirSync(OUT_DIR).filter((f) => /^watch-.*\.jpg$/.test(f) || f === 'og-sabrxwatches.jpg');
  for (const f of files) {
    const b = fs.readFileSync(path.join(OUT_DIR, f));
    const d = jpegDims(b);
    const h = crypto.createHash('md5').update(b).digest('hex');
    const dup = seen[h] ? 'DUPLICATE-OF:' + seen[h] : '';
    seen[h] = f;
    console.log(f.padEnd(30), b < 15000 ? 'FAIL-BYTES' : 'bytes-ok', String(b.length).padStart(8),
      d ? d.width + 'x' + d.height : 'NOT-JPEG', dup);
  }
  console.log('total files:', files.length);
}

async function cmdOg(id) {
  const src = path.join(OUT_DIR, 'watch-' + id + '.jpg');
  fs.copyFileSync(src, path.join(OUT_DIR, 'og-sabrxwatches.jpg'));
  console.log('copied watch-' + id + '.jpg -> og-sabrxwatches.jpg');
}

async function cmdOgUrl(url) {
  const f = await get(url);
  if (f.status !== 200 || f.body.length < 15000 || !jpegDims(f.body)) throw new Error('bad image');
  fs.writeFileSync(path.join(OUT_DIR, 'og-sabrxwatches.jpg'), f.body);
  const d = jpegDims(f.body);
  console.log('OK og-sabrxwatches.jpg', d.width + 'x' + d.height, f.body.length + 'B');
}

(async () => {
  const [, , cmd, a, b] = process.argv;
  if (cmd === 'list') return cmdList(a, b);
  if (cmd === 'grab') return cmdGrab(a, b);
  if (cmd === 'check') return cmdCheck();
  if (cmd === 'og') return cmdOg(a);
  if (cmd === 'ogurl') return cmdOgUrl(a);
  console.log('commands: list | grab | check | og | ogurl');
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
