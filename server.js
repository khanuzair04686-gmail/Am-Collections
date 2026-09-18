// AM COLLECTION - Full-Stack Express Server with NeDB (Free Embedded Database)
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Datastore = require('@seald-io/nedb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_PASSKEY = process.env.ADMIN_PASSKEY || 'admin123';

// =====================================================
// DIRECTORY SETUP
// =====================================================
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;
const UPLOADS_DIR = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
const DATA_DIR = isVercel ? path.join('/tmp', 'data') : path.join(__dirname, 'data');
[UPLOADS_DIR, DATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { console.warn('Directory create warn:', e.message); }
  }
});


// =====================================================
// MIDDLEWARE
// =====================================================
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(__dirname));

// =====================================================
// MULTER - FILE UPLOADS
// =====================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = file.fieldname === 'logo' ? 'logo' : 'watch';
    cb(null, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB — supports video
  fileFilter: (req, file, cb) => {
    const allowedImg   = /jpeg|jpg|png|webp|svg|gif/;
    const allowedVideo = /mp4|webm|mov|avi|mkv|m4v/;
    const ext  = path.extname(file.originalname).toLowerCase().replace('.','');
    const mime = file.mimetype;
    if (allowedImg.test(ext) || allowedImg.test(mime) ||
        allowedVideo.test(ext) || allowedVideo.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Only image or video files are allowed!'));
    }
  }
});

// Multi-field upload: supports image + video in one request
const uploadMedia = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

// =====================================================
// NEDB DATABASES (One file per collection in data/)
// =====================================================
const db = {
  products:  new Datastore({ filename: path.join(DATA_DIR, 'products.db'),  autoload: true }),
  settings:  new Datastore({ filename: path.join(DATA_DIR, 'settings.db'),  autoload: true }),
  orders:    new Datastore({ filename: path.join(DATA_DIR, 'orders.db'),    autoload: true }),
  users:     new Datastore({ filename: path.join(DATA_DIR, 'users.db'),     autoload: true }),
};

// Compact databases periodically to keep files small
setInterval(() => {
  db.products.compactDatafile();
  db.orders.compactDatafile();
  db.users.compactDatafile();
}, 30000);

// =====================================================
// DEFAULT SEED DATA
// =====================================================
const DEFAULT_SETTINGS = {
  storeName: 'AM COLLECTION',
  tagline: 'Timeless Elegance - Master Copy Watches',
  logoUrl: '',
  storePhone: '919876543210',
  announcementText: '💎 FESTIVE PRIVILEGE: FREE Pan-India Cash on Delivery + 7-Day Replacement Guarantee'
};

const DEFAULT_PRODUCTS = [
  { id:'amc-01', brand:'Rolex', model:'Submariner Date 41mm Ceramic', tagline:'1:1 Super Clone Master Edition', price:4499, originalPrice:1150000, rating:4.9, reviewsCount:148, badge:'BEST SELLER', category:'rolex', movement:'Japanese Automatic Movement', dialSize:'41 mm', glass:'Sapphire Crystal (Anti-Reflective)', strap:'Solid 904L Stainless Steel Oyster', waterResistance:'Daily Splash & Rain Proof (30m)', clasp:'Oysterlock safety clasp with Glidelock', image:'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop', description:'The archetype of the diver\'s watch. Featuring exact 1:1 weight, unidirectional rotating ceramic bezel with platinum coated graduations, and sweeping second hand.', features:['Exact 1:1 weight & dimensions','Ceramic rotating Cerachrom bezel','Sweeping smooth automatic movement','Luminescent Chromalight hands & indices','Laser etched crown at 6 o\'clock on glass'] },
  { id:'amc-02', brand:'Rolex', model:'Cosmograph Daytona Yellow Gold', tagline:'Oysterflex Chronograph Master Edition', price:5999, originalPrice:2850000, rating:5.0, reviewsCount:204, badge:'PREMIUM MASTER', category:'rolex', movement:'Functional Chronograph Automatic', dialSize:'40 mm', glass:'Scratch-Proof Sapphire Glass', strap:'High-Density Oysterflex Black Rubber', waterResistance:'Daily Splash Proof', clasp:'18K Yellow Gold Plated Folding Oysterlock', image:'https://images.unsplash.com/photo-1547996160-71dfabb1a7b1?q=80&w=800&auto=format&fit=crop', description:'Designed to meet the demands of racing drivers. Iconic black Cerachrom bezel with tachymetric scale in 18ct yellow gold electroplating.', features:['Working chronograph sub-dials','Deep 18k thick gold electroplating','Heavy premium weight matching original','Oysterflex elastomer strap with inner metal blade','Engraved tachymeter scale on bezel'] },
  { id:'amc-03', brand:'Patek Philippe', model:'Nautilus 5711/1R Rose Gold', tagline:'Iconic Horology Master Clone', price:6499, originalPrice:6500000, rating:4.9, reviewsCount:182, badge:'ULTRA LUXURY', category:'patek', movement:'Miyota Japanese Automatic Movement', dialSize:'40 mm', glass:'Double AR-Coated Sapphire Crystal', strap:'Rose Gold Plated Brushed & Polished Steel', waterResistance:'30m Water Resistant', clasp:'Nautilus fold-over clasp', image:'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=800&auto=format&fit=crop', description:'The pinnacle of luxury sports watches. Featuring the rounded octagonal bezel, ingenious porthole construction of its case and horizontally embossed dial.', features:['Exquisite horizontal embossed dial texture','Exhibition see-through sapphire case back','Brushed and mirror-polished case finishing','Smooth gliding rose gold bracelet','Date display at 3 o\'clock'] },
  { id:'amc-04', brand:'Audemars Piguet', model:'Royal Oak Double Balance Wheel', tagline:'Openworked Skeleton Masterpiece', price:6999, originalPrice:7500000, rating:5.0, reviewsCount:96, badge:'SKELETON MASTER', category:'ap', movement:'Skeleton Automatic Movement', dialSize:'41 mm', glass:'Curved Scratch-Resistant Sapphire', strap:'Integrated Stainless Steel Royal Oak Bracelet', waterResistance:'Splash Proof', clasp:'AP folding clasp with twin safety pushers', image:'https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?q=80&w=800&auto=format&fit=crop', description:'A feast for the eyes. Full skeletonized dial showing the intricate movement gears, famous octagonal bezel with 8 hexagonal white gold screws.', features:['Visible skeleton mechanics front and back','Signature octagonal bezel with polished screws','Tapered integrated AP stainless steel bracelet','Dual balance wheel visual simulation','Heavy solid wrist feel (170g+)'] },
  { id:'amc-05', brand:'Audemars Piguet', model:'Royal Oak Chronograph 41mm Blue', tagline:'Grande Tapisserie Royal Oak', price:5899, originalPrice:3800000, rating:4.8, reviewsCount:134, badge:'TOP RATED', category:'ap', movement:'High-Precision Chronograph Movement', dialSize:'41 mm', glass:'Glareproof Sapphire Crystal', strap:'Hand-finished Brushed Stainless Steel', waterResistance:'30m Daily Water Resistant', clasp:'AP Double-Deployant Buckle', image:'https://images.unsplash.com/photo-1524805444758-089113d48a6d?q=80&w=800&auto=format&fit=crop', description:'Blue dial with Grande Tapisserie pattern, rhodium-toned counters, luminescent Royal Oak hands and white gold applied hour-markers.', features:['Genuine 3D "Grande Tapisserie" guilloche pattern','Active stopwatch chronograph subdials','Iconic Gerald Genta design proportions','Double push-button deployment buckle','Sharp beveled edge hand finishing'] },
  { id:'amc-06', brand:'Casio Vintage', model:'Vintage Digital Gold A168WG-9WDF', tagline:'Retro Classic All-Gold Edition', price:1899, originalPrice:4495, rating:4.9, reviewsCount:320, badge:'HOT DEAL', category:'casio', movement:'Japanese Digital Quartz Caliber', dialSize:'36.3 mm', glass:'Hardened Mineral Resin Glass', strap:'Adjustable Stainless Steel Gold Mesh Band', waterResistance:'Water Resistant for Daily Use', clasp:'Sliding micro-adjustable clasp', image:'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=800&auto=format&fit=crop', description:'The golden icon of 80s timeless style. Featuring classic gold ion plating, electroluminescent backlight, 1/100-second stopwatch, daily alarm and auto calendar.', features:['Original ElectroLuminescent blue-green backlight','1/100-second precision stopwatch & timer','Daily alarm & hourly time signal','Self-adjustable clasp (no tool required)','Featherlight & extremely comfortable on wrist'] },
  { id:'amc-07', brand:'Rolex', model:'Datejust 41 Fluted Slate Roman (Wimbledon)', tagline:'Jubilee Two-Tone Everose Gold', price:4699, originalPrice:1450000, rating:4.9, reviewsCount:165, badge:'CELEBRITY CHOICE', category:'rolex', movement:'Japanese Automatic Self-Winding', dialSize:'41 mm', glass:'Sapphire with 2.5x Cyclops Date Magnifier', strap:'Five-Piece Jubilee Two-Tone Bracelet', waterResistance:'Splash Proof', clasp:'Folding Oysterclasp with Easylink 5mm', image:'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?q=80&w=800&auto=format&fit=crop', description:'The world-renowned Wimbledon edition. Slate grey sunray dial adorned with dark green Roman numerals outlined in black, paired with radiant fluted bezel.', features:['Accurate green outlined Roman numerals','Fluted bezel capturing light at every angle','Supple 5-link Jubilee bracelet with smooth links','Magnified date aperture at 3 o\'clock','Sweeping second hand without tick-tock stutter'] },
  { id:'amc-08', brand:'Patek Philippe', model:'Aquanaut 5167A Black Dial', tagline:'Modern Sport Chic Master Clone', price:5499, originalPrice:4200000, rating:4.8, reviewsCount:119, badge:'LIMITED STOCK', category:'patek', movement:'Japanese Automatic Movement', dialSize:'40.8 mm', glass:'Sapphire Crystal with Anti-Glare Coating', strap:'Ultra-Resistant Tropical Black Rubber', waterResistance:'Daily Waterproof', clasp:'Fold-over Aquanaut clasp', image:'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=800&auto=format&fit=crop', description:'Youthful, dynamic and casually elegant. The embossed dial reflects the textured pattern of the waterproof strap made of high-tech composite material.', features:['Curved octagonal case silhouette','Geosphere embossed dial texture','Premium dust-repellent tropical rubber strap','Luminescent Arabic numerals and hands','Transparent back with engraved rotor'] },
  { id:'amc-09', brand:'Cartier', model:'Santos de Cartier Large Two-Tone', tagline:'Aviation Heritage Square Icon', price:4999, originalPrice:1050000, rating:4.9, reviewsCount:142, badge:'ROYAL HERITAGE', category:'cartier', movement:'Japanese Automatic Movement', dialSize:'39.8 mm', glass:'High-Purity Sapphire Crystal', strap:'Two-Tone Gold & Steel with SmartLink Screws', waterResistance:'Daily Splash Proof', clasp:'Double deployant hidden butterfly buckle', image:'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop', description:'The first purpose-designed modern wristwatch. Famous square bezel fastened with eight visible screws and graduated Roman dial with sword-shaped blued hands.', features:['Signature 7-sided crown set with blue synthetic spinel','Sword-shaped blued steel hands','Satin-brushed case with mirror-polished beveled edges','Iconic Cartier secret signature at VII hour marker','Comfortable wrist curvature for ergonomic fit'] },
  { id:'amc-10', brand:'Hublot', model:'Big Bang Unico King Gold Ceramic', tagline:'The Art of Fusion Master Clone', price:5299, originalPrice:2400000, rating:4.7, reviewsCount:88, badge:'BOLD & ICONIC', category:'hublot', movement:'Quartz Flyback Chronograph System', dialSize:'44 mm', glass:'Sapphire Crystal with Anti-Reflective Treatment', strap:'Structured Lined Black Rubber Strap', waterResistance:'Daily Splash Proof', clasp:'18K King Gold Plated Deployant Buckle', image:'https://images.unsplash.com/photo-1539185441755-769473a23570?q=80&w=800&auto=format&fit=crop', description:'A revolutionary timepiece blending high-tech ceramic with King Gold hue. Features openwork matte black dial with red accents and column-wheel mechanism.', features:['Bold 44mm statement case construction','Satin-finished and polished black ceramic bezel','H-shaped titanium bezel screws','Ribbed high-grade vulcanized rubber strap','Quick-release "One Click" strap system look'] },
  { id:'amc-11', brand:'Omega', model:'Speedmaster Professional Moonwatch', tagline:'The First Watch Worn on the Moon', price:4799, originalPrice:780000, rating:5.0, reviewsCount:175, badge:'LEGENDARY MOON', category:'omega', movement:'Mechanical Chronograph Movement', dialSize:'42 mm', glass:'Sapphire Crystal (Front & Exhibition Back)', strap:'Brushed Five-Arched-Links Stainless Steel', waterResistance:'30m Splash Proof', clasp:'Foldover clasp with comfort setting', image:'https://images.unsplash.com/photo-1594576722512-582bcd46fba3?q=80&w=800&auto=format&fit=crop', description:'Part of all six moon landings. Asymmetrical case, step dial, the famous dot over 90 on the anodised aluminium bezel ring and legendary chronograph subdials.', features:['Historic "Dot Over 90" tachymeter bezel ring','Step dial with recessed sub-dials','Super-LumiNova hour indices','Smooth chronograph pusher actuation','Engraved Seahorse medallion and sapphire caseback'] },
  { id:'amc-12', brand:'Casio Vintage', model:'Edifice Chronograph EFR Rose-Gold Edition', tagline:'Speed & Intelligence Executive Series', price:2499, originalPrice:11995, rating:4.8, reviewsCount:210, badge:'VALUE MASTER', category:'casio', movement:'Japanese Multi-Dial Quartz Chrono', dialSize:'43 mm', glass:'Mineral Glass with Anti-Scratch Coating', strap:'Genuine Perforated Leather Band', waterResistance:'50m Water Resistant', clasp:'Rose Gold Plated Tang Buckle', image:'https://images.unsplash.com/photo-1526045478516-99145907023c?q=80&w=800&auto=format&fit=crop', description:'Motorsport inspired dynamic chronograph with rose gold ion plated case, multi-layered black carbon fiber dial texture, and genuine leather racing strap.', features:['Triple sub-dial chronograph with date window','Rose gold ionic plating with high luster','Genuine padded leather strap with contrast stitch','Long-lasting Japanese battery lifespan (3+ years)','Substantial masculine wrist presence'] }
];

// =====================================================
// NEDB PROMISE HELPERS
// =====================================================
const nedb = {
  find: (col, query = {}) => new Promise((res, rej) => col.find(query, (err, docs) => err ? rej(err) : res(docs))),
  findOne: (col, query) => new Promise((res, rej) => col.findOne(query, (err, doc) => err ? rej(err) : res(doc))),
  insert: (col, doc) => new Promise((res, rej) => col.insert(doc, (err, newDoc) => err ? rej(err) : res(newDoc))),
  update: (col, query, update, opts = {}) => new Promise((res, rej) => col.update(query, { $set: update }, opts, (err, n) => err ? rej(err) : res(n))),
  remove: (col, query, opts = {}) => new Promise((res, rej) => col.remove(query, opts, (err, n) => err ? rej(err) : res(n))),
  count: (col, query = {}) => new Promise((res, rej) => col.count(query, (err, n) => err ? rej(err) : res(n))),
};

// =====================================================
// SEED DATABASE ON STARTUP
// =====================================================
async function seedDatabase() {
  try {
    // Seed products if empty
    const productCount = await nedb.count(db.products);
    if (productCount === 0) {
      console.log('🌱 Seeding default watches into NeDB...');
      for (const p of DEFAULT_PRODUCTS) {
        await nedb.insert(db.products, p);
      }
      console.log(`✅ ${DEFAULT_PRODUCTS.length} watches seeded successfully!`);
    }

    // Seed settings if empty
    const settingsCount = await nedb.count(db.settings);
    if (settingsCount === 0) {
      await nedb.insert(db.settings, DEFAULT_SETTINGS);
      console.log('✅ Default store settings saved!');
    }
  } catch (err) {
    console.error('Seed error:', err);
  }
}

// =====================================================
// REST API ROUTES
// =====================================================

// Health Check
app.get('/api/health', async (req, res) => {
  const productCount = await nedb.count(db.products);
  const orderCount   = await nedb.count(db.orders);
  res.json({
    status: 'ok',
    database: 'NeDB (Embedded — No server required!)',
    products: productCount,
    orders: orderCount,
    uptime: Math.round(process.uptime()) + 's'
  });
});

async function getAdminPasskey() {
  const s = await nedb.findOne(db.settings, {});
  return (s && s.adminPasskey) ? s.adminPasskey : (process.env.ADMIN_PASSKEY || 'admin123');
}

// ─── SETTINGS ────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    let s = await nedb.findOne(db.settings, {});
    if (!s) {
      s = await nedb.insert(db.settings, DEFAULT_SETTINGS);
    }
    const safeSettings = { ...s };
    delete safeSettings.adminPasskey;
    res.json(safeSettings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { storeName, tagline, storePhone, announcementText } = req.body;
    const existing = await nedb.findOne(db.settings, {});
    if (!existing) {
      const s = await nedb.insert(db.settings, { storeName, tagline, storePhone, announcementText });
      return res.json({ success: true, settings: s });
    }
    await nedb.update(db.settings, { _id: existing._id }, { storeName, tagline, storePhone, announcementText });
    const updated = await nedb.findOne(db.settings, {});
    res.json({ success: true, settings: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Logo Upload
app.post('/api/settings/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logoUrl = `/uploads/${req.file.filename}`;
    const existing = await nedb.findOne(db.settings, {});
    if (existing) {
      await nedb.update(db.settings, { _id: existing._id }, { logoUrl });
    } else {
      await nedb.insert(db.settings, { ...DEFAULT_SETTINGS, logoUrl });
    }
    res.json({ success: true, logoUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PRODUCTS ────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    let products = await nedb.find(db.products);
    const { category, search, sort } = req.query;

    if (category && category !== 'all') {
      products = products.filter(p => p.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      products = products.filter(p =>
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        (p.movement && p.movement.toLowerCase().includes(q))
      );
    }
    if (sort === 'price-low')  products.sort((a, b) => a.price - b.price);
    if (sort === 'price-high') products.sort((a, b) => b.price - a.price);
    if (sort === 'rating')     products.sort((a, b) => b.rating - a.rating);

    res.json(products);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const p = await nedb.findOne(db.products, { id: req.params.id });
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', uploadMedia, async (req, res) => {
  try {
    const b = req.body;
    const files = req.files || {};

    let image = b.imageUrl || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop';
    if (files.image && files.image[0]) image = `/uploads/${files.image[0].filename}`;

    let videoUrl = b.videoUrl || '';
    if (files.video && files.video[0]) videoUrl = `/uploads/${files.video[0].filename}`;

    const product = {
      id:              `amc-${Date.now().toString().slice(-8)}`,
      brand:           b.brand || 'Luxury Brand',
      model:           b.model || 'Master Edition',
      tagline:         b.tagline || '1:1 Master Copy',
      price:           Number(b.price) || 3999,
      originalPrice:   Number(b.originalPrice) || 850000,
      rating:          Number(b.rating) || 4.9,
      reviewsCount:    Number(b.reviewsCount) || 50,
      badge:           b.badge || 'NEW ARRIVAL',
      category:        (b.category || 'other').toLowerCase(),
      movement:        b.movement || 'Japanese Automatic Movement',
      dialSize:        b.dialSize || '41 mm',
      glass:           b.glass || 'Sapphire Crystal',
      strap:           b.strap || '904L Stainless Steel',
      waterResistance: b.waterResistance || 'Daily Splash Proof',
      clasp:           b.clasp || 'Deployment Clasp',
      description:     b.description || '1:1 Master Copy luxury timepiece.',
      features: Array.isArray(b.features)
        ? b.features
        : (b.features ? b.features.split('\n').map(f => f.trim()).filter(Boolean) : ['1:1 exact weight & dimensions']),
      image,
      videoUrl,
      createdAt: new Date().toISOString()
    };

    const saved = await nedb.insert(db.products, product);
    res.status(201).json({ success: true, product: saved });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/products/:id', uploadMedia, async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body;
    const files = req.files || {};
    const updates = { ...b };

    if (updates.price)         updates.price         = Number(updates.price);
    if (updates.originalPrice) updates.originalPrice = Number(updates.originalPrice);
    if (updates.rating)        updates.rating        = Number(updates.rating);
    if (updates.reviewsCount)  updates.reviewsCount  = Number(updates.reviewsCount);

    if (files.image && files.image[0]) updates.image = `/uploads/${files.image[0].filename}`;
    else if (b.imageUrl)               updates.image = b.imageUrl;

    if (files.video && files.video[0]) updates.videoUrl = `/uploads/${files.video[0].filename}`;
    else if (b.videoUrl !== undefined)  updates.videoUrl = b.videoUrl;

    if (typeof updates.features === 'string') {
      updates.features = updates.features.split('\n').map(f => f.trim()).filter(Boolean);
    }
    delete updates._id;

    const n = await nedb.update(db.products, { id }, updates);
    if (!n) return res.status(404).json({ error: 'Product not found' });

    const updated = await nedb.findOne(db.products, { id });
    res.json({ success: true, product: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const n = await nedb.remove(db.products, { id: req.params.id });
    if (!n) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, message: `Watch ${req.params.id} deleted` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Reset to default catalog
app.post('/api/products/reset', async (req, res) => {
  try {
    await nedb.remove(db.products, {}, { multi: true });
    for (const p of DEFAULT_PRODUCTS) {
      await nedb.insert(db.products, p);
    }
    const all = await nedb.find(db.products);
    res.json({ success: true, count: all.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ORDERS ──────────────────────────────────────────
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await nedb.find(db.orders);
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/orders', async (req, res) => {
  try {
    const order = {
      ...req.body,
      orderId: req.body.orderId || `AMC-${Math.floor(10000 + Math.random() * 90000)}`,
      createdAt: new Date().toISOString(),
      status: req.body.status || 'Pending COD Dispatch'
    };
    const saved = await nedb.insert(db.orders, order);
    res.status(201).json({ success: true, order: saved });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await nedb.update(db.orders, { orderId: id }, { status });
    const updated = await nedb.findOne(db.orders, { orderId: id });
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true, order: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    await nedb.remove(db.orders, { orderId: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Generic upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ success: true, fileUrl: `/uploads/${req.file.filename}` });
});

// Admin Auth Verification
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { passkey } = req.body;
    const currentKey = await getAdminPasskey();
    if (passkey === currentKey) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Invalid passkey' });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Change Admin Passkey
app.post('/api/auth/change-passkey', async (req, res) => {
  try {
    const { currentPasskey, newPasskey } = req.body;
    if (!newPasskey || newPasskey.trim().length < 4) {
      return res.status(400).json({ error: 'New passkey must be at least 4 characters long.' });
    }
    const currentKey = await getAdminPasskey();
    if (currentPasskey !== currentKey) {
      return res.status(401).json({ error: 'Current passkey is incorrect.' });
    }

    const existing = await nedb.findOne(db.settings, {});
    if (existing) {
      await nedb.update(db.settings, { _id: existing._id }, { adminPasskey: newPasskey.trim() });
    } else {
      await nedb.insert(db.settings, { ...DEFAULT_SETTINGS, adminPasskey: newPasskey.trim() });
    }

    res.json({ success: true, message: 'Admin passkey updated successfully! 🔒' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =====================================================
// CUSTOMER AUTHENTICATION (NO OTP + GOOGLE SIGN-IN)
// =====================================================

// Customer Registration (No OTP)
app.post('/api/customer/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide Name, Email, and Password.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = await nedb.findOne(db.users, { email: cleanEmail });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists. Please Sign In!' });
    }

    const newUser = {
      userId: `AMC-USR-${Date.now().toString().slice(-6)}`,
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
      phone: (phone || '').trim(),
      authProvider: 'email',
      createdAt: new Date().toISOString()
    };

    const saved = await nedb.insert(db.users, newUser);
    const userSafe = { ...saved };
    delete userSafe.password;

    res.status(201).json({
      success: true,
      message: `Welcome to AM COLLECTION, ${userSafe.name}! ✨`,
      user: userSafe
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer Login (Email + Password)
app.post('/api/customer/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await nedb.findOne(db.users, { email: cleanEmail });
    if (!user || user.password !== password.trim()) {
      return res.status(401).json({ error: 'Incorrect email or password. Please try again or create an account.' });
    }

    const userSafe = { ...user };
    delete userSafe.password;

    res.json({
      success: true,
      message: `Welcome back, ${user.name}! 👑`,
      user: userSafe
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Continue with Google (One-click: if no account, auto create account!)
app.post('/api/customer/google', async (req, res) => {
  try {
    const { email, name, avatar } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Google email is required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    let user = await nedb.findOne(db.users, { email: cleanEmail });

    if (!user) {
      // Auto create account if none exists!
      const newUser = {
        userId: `AMC-USR-G-${Date.now().toString().slice(-6)}`,
        name: (name || cleanEmail.split('@')[0]).trim(),
        email: cleanEmail,
        avatar: avatar || '',
        phone: '',
        authProvider: 'google',
        createdAt: new Date().toISOString()
      };
      user = await nedb.insert(db.users, newUser);
      return res.status(201).json({
        success: true,
        isNewUser: true,
        message: `Google Account created! Welcome, ${user.name}! 🌟`,
        user
      });
    }

    // Existing user -> log in directly!
    const userSafe = { ...user };
    delete userSafe.password;
    res.json({
      success: true,
      isNewUser: false,
      message: `Welcome back, ${user.name}! 🌟`,
      user: userSafe
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Customer Orders
app.get('/api/customer/orders/:emailOrPhone', async (req, res) => {
  try {
    const query = req.params.emailOrPhone.trim().toLowerCase();
    const allOrders = await nedb.find(db.orders);
    const userOrders = allOrders.filter(o => {
      const emailMatch = o.customerEmail && o.customerEmail.toLowerCase() === query;
      const phoneMatch = o.phone && o.phone.replace(/\D/g, '').includes(query.replace(/\D/g, ''));
      return emailMatch || phoneMatch;
    });
    userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(userOrders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Customer Profile
app.put('/api/customer/profile', async (req, res) => {
  try {
    const { email, name, phone, address, landmark, city, state, pincode } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required to update profile.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = await nedb.findOne(db.users, { email: cleanEmail });
    if (!existing) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const updatedData = {
      ...existing,
      name: name ? name.trim() : existing.name,
      phone: phone !== undefined ? phone.trim() : (existing.phone || ''),
      address: address !== undefined ? address.trim() : (existing.address || ''),
      landmark: landmark !== undefined ? landmark.trim() : (existing.landmark || ''),
      city: city !== undefined ? city.trim() : (existing.city || ''),
      state: state !== undefined ? state.trim() : (existing.state || ''),
      pincode: pincode !== undefined ? pincode.trim() : (existing.pincode || ''),
      updatedAt: new Date().toISOString()
    };

    await nedb.update(db.users, { _id: existing._id }, updatedData);
    const userSafe = { ...updatedData };
    delete userSafe.password;

    res.json({
      success: true,
      message: 'Profile information updated successfully! ✨',
      user: userSafe
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Customer Profile Details
app.get('/api/customer/profile/:email', async (req, res) => {
  try {
    const cleanEmail = req.params.email.trim().toLowerCase();
    const user = await nedb.findOne(db.users, { email: cleanEmail });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const userSafe = { ...user };
    delete userSafe.password;
    res.json(userSafe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback SPA route
app.get('*', (req, res) => {
  if (req.path.startsWith('/admin')) {
    res.sendFile(path.join(__dirname, 'admin.html'));
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// =====================================================
// START SERVER
// =====================================================
async function startServer() {
  await seedDatabase();
  app.listen(PORT, () => {
    console.log('\n======================================================');
    console.log('🌟 AM COLLECTION Luxury Watch Engine is Running!');
    console.log(`🌐 Storefront:      http://localhost:${PORT}`);
    console.log(`👑 Admin Dashboard: http://localhost:${PORT}/admin.html`);
    console.log('📦 Database:        NeDB (Free · Embedded · No Server Needed!)');
    console.log('💾 Data stored in:  ./data/ folder');
    console.log('======================================================\n');
  });
}
 
if (require.main === module) {
  startServer();
} else {
  seedDatabase().catch(console.error);
}

module.exports = app;

