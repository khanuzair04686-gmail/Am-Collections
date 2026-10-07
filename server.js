// sabrXwatches - Enterprise Luxury Watch E-Commerce Server
// Permanent MongoDB Atlas Database Architecture (Full Mongoose Models + Direct Cloud Persistence)

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_PASSKEY = process.env.ADMIN_PASSKEY || 'admin123';
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || '';

// =====================================================
// DIRECTORIES
// =====================================================
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;
const UPLOADS_DIR = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

// =====================================================
// MIDDLEWARE
// =====================================================
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(__dirname));

// =====================================================
// FILE UPLOADS (MULTER)
// =====================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = file.fieldname === 'logo' ? 'logo' : (file.fieldname === 'banner' ? 'banner' : (file.fieldname === 'photo' ? 'team' : 'watch'));
    cb(null, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024, fieldSize: 12 * 1024 * 1024 }, // 200MB media, large embedded image fields
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|svg|gif|mp4|webm|mov|avi|mkv|m4v|ico/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext) || allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only valid image or video files are allowed!'));
    }
  }
});

const uploadMedia = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

// Team photo uploads — strict image-only validation (JPG/JPEG/PNG/WebP, max 5MB)
const uploadPhoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext) || allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG or WebP images are allowed for team photos!'));
    }
  }
});

// =====================================================
// INITIAL DEFAULTS (Used ONLY on very first initialization)
// =====================================================
const INITIAL_SETTINGS = {
  storeName: 'sabrXwatches',
  tagline: 'Timeless Elegance - Master Copy Watches',
  logoUrl: '',
  faviconUrl: '',
  storePhone: '919876543210',
  announcementText: '✨ Cash on Delivery available on eligible serviceable pincodes',
  coinEarnRate: 1, // 1 coin per ₹100 spent
  coinRedeemRate: 1, // 1 coin = ₹1 discount
  adminPasskey: ADMIN_PASSKEY,
  isCatalogInitialized: false
};

const INITIAL_PRODUCTS = [
  { id:'amc-01', brand:'Rolex', model:'Submariner Date 41mm Ceramic', tagline:'1:1 Super Clone Master Edition', price:4499, originalPrice:1150000, rating:4.9, reviewsCount:148, badge:'BEST SELLER', category:'rolex', movement:'Japanese Automatic Movement', dialSize:'41 mm', glass:'Sapphire Crystal (Anti-Reflective)', strap:'Solid 904L Stainless Steel Oyster', image:'/uploads/watch-amc-01.jpg', description:'The archetype of the diver\'s watch. 1:1 weight, unidirectional rotating ceramic bezel, and sweeping second hand.', features:['Exact 1:1 weight & dimensions','Ceramic rotating Cerachrom bezel','Sweeping smooth automatic movement','Luminescent Chromalight hands & indices','Laser etched crown at 6 o\'clock'], isBestSeller:true, isNewArrival:false, isTrending:true, stock:25, isHidden:false },
  { id:'amc-02', brand:'Rolex', model:'Cosmograph Daytona Yellow Gold', tagline:'Oysterflex Chronograph Master Edition', price:5999, originalPrice:2850000, rating:5.0, reviewsCount:204, badge:'PREMIUM MASTER', category:'rolex', movement:'Functional Chronograph Automatic', dialSize:'40 mm', glass:'Scratch-Proof Sapphire Glass', strap:'High-Density Oysterflex Black Rubber', image:'https://images.unsplash.com/photo-1547996160-71dfabb1a7b1?q=80&w=800&auto=format&fit=crop', description:'Iconic black Cerachrom bezel with tachymetric scale in 18ct yellow gold electroplating.', features:['Working chronograph sub-dials','Deep 18k thick gold electroplating','Heavy weight matching original','Oysterflex elastomer strap'], isBestSeller:true, isNewArrival:false, isTrending:true, stock:18, isHidden:false },
  { id:'amc-03', brand:'Patek Philippe', model:'Nautilus 5711/1R Rose Gold', tagline:'Iconic Horology Master Clone', price:6499, originalPrice:6500000, rating:4.9, reviewsCount:182, badge:'ULTRA LUXURY', category:'patek', movement:'Miyota Japanese Automatic Movement', dialSize:'40 mm', glass:'Double AR-Coated Sapphire Crystal', strap:'Rose Gold Plated Brushed Steel', image:'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=800&auto=format&fit=crop', description:'The pinnacle of luxury sports watches. Rounded octagonal bezel and horizontally embossed dial.', features:['Exquisite horizontal embossed dial','See-through exhibition sapphire back','Smooth gliding rose gold bracelet','Date display at 3 o\'clock'], isBestSeller:true, isNewArrival:true, isTrending:true, stock:12, isHidden:false },
  { id:'amc-04', brand:'Audemars Piguet', model:'Royal Oak Double Balance Wheel', tagline:'Openworked Skeleton Masterpiece', price:6999, originalPrice:7500000, rating:5.0, reviewsCount:96, badge:'SKELETON MASTER', category:'ap', movement:'Skeleton Automatic Movement', dialSize:'41 mm', glass:'Curved Scratch-Resistant Sapphire', strap:'Integrated Stainless Steel AP Bracelet', image:'https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?q=80&w=800&auto=format&fit=crop', description:'Visible skeleton mechanics front and back, octagonal bezel with 8 hexagonal screws.', features:['Visible skeleton mechanics front and back','Signature octagonal bezel with screws','Tapered integrated AP steel bracelet'], isBestSeller:false, isNewArrival:true, isTrending:true, stock:8, isHidden:false },
  { id:'amc-05', brand:'Casio Vintage', model:'Vintage Digital Gold A168WG-9WDF', tagline:'Retro Classic All-Gold Edition', price:1899, originalPrice:4495, rating:4.9, reviewsCount:320, badge:'HOT DEAL', category:'casio', movement:'Japanese Digital Quartz Caliber', dialSize:'36.3 mm', glass:'Hardened Mineral Glass', strap:'Adjustable Stainless Steel Gold Mesh', image:'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=800&auto=format&fit=crop', description:'The golden icon of 80s timeless style. Classic gold ion plating and electroluminescent backlight.', features:['Original ElectroLuminescent backlight','1/100-second stopwatch & timer','Daily alarm & calendar','Self-adjustable clasp'], isBestSeller:true, isNewArrival:false, isTrending:false, stock:40, isHidden:false },
  { id:'amc-06', brand:'Cartier', model:'Santos de Cartier Large Two-Tone', tagline:'Aviation Heritage Square Icon', price:4999, originalPrice:1050000, rating:4.9, reviewsCount:142, badge:'ROYAL HERITAGE', category:'cartier', movement:'Japanese Automatic Movement', dialSize:'39.8 mm', glass:'High-Purity Sapphire Crystal', strap:'Two-Tone Gold & Steel with SmartLink', image:'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop', description:'Famous square bezel fastened with eight visible screws and graduated Roman dial.', features:['7-sided crown set with blue synthetic spinel','Sword-shaped blued steel hands','Satin-brushed case with mirror beveled edges'], isBestSeller:false, isNewArrival:false, isTrending:true, stock:15, isHidden:false },
  { id:'amc-07', brand:'Omega', model:'Speedmaster Professional Moonwatch', tagline:'The First Watch Worn on the Moon', price:4799, originalPrice:780000, rating:5.0, reviewsCount:175, badge:'LEGENDARY MOON', category:'omega', movement:'Mechanical Chronograph Movement', dialSize:'42 mm', glass:'Sapphire Crystal (Front & Back)', strap:'Brushed Five-Arched-Links Steel', image:'https://images.unsplash.com/photo-1594576722512-582bcd46fba3?q=80&w=800&auto=format&fit=crop', description:'Historic Dot Over 90 tachymeter bezel ring, step dial with recessed sub-dials.', features:['Historic Dot Over 90 tachymeter ring','Step dial with recessed sub-dials','Super-LumiNova hour indices'], isBestSeller:false, isNewArrival:false, isTrending:true, stock:14, isHidden:false },
  { id:'amc-08', brand:'Hublot', model:'Big Bang Unico King Gold Ceramic', tagline:'The Art of Fusion Master Clone', price:5299, originalPrice:2400000, rating:4.7, reviewsCount:88, badge:'BOLD & ICONIC', category:'hublot', movement:'Quartz Flyback Chronograph System', dialSize:'44 mm', glass:'Sapphire Crystal with Anti-Reflective', strap:'Structured Lined Black Rubber Strap', image:'https://images.unsplash.com/photo-1539185441755-769473a23570?q=80&w=800&auto=format&fit=crop', description:'High-tech ceramic with King Gold hue. Features openwork matte black dial with red accents.', features:['Bold 44mm statement case','Satin-finished black ceramic bezel','Ribbed vulcanized rubber strap'], isBestSeller:false, isNewArrival:true, isTrending:false, stock:10, isHidden:false }
];

const INITIAL_CATEGORIES = [
  { id:'cat-rolex', name:'Rolex', slug:'rolex', icon:'👑', sortOrder:1 },
  { id:'cat-patek', name:'Patek Philippe', slug:'patek', icon:'⚜️', sortOrder:2 },
  { id:'cat-ap', name:'Audemars Piguet', slug:'ap', icon:'⚡', sortOrder:3 },
  { id:'cat-omega', name:'Omega', slug:'omega', icon:'🚀', sortOrder:4 },
  { id:'cat-cartier', name:'Cartier', slug:'cartier', icon:'💎', sortOrder:5 },
  { id:'cat-hublot', name:'Hublot', slug:'hublot', icon:'🖤', sortOrder:6 },
  { id:'cat-casio', name:'Casio Vintage', slug:'casio', icon:'⌚', sortOrder:7 }
];

// About Us page — seeded ONLY on very first creation (admin editable afterwards)
const DEFAULT_ABOUT = {
  pageTitle: 'About sabrXwatches',
  intro: 'sabrXwatches curates master-grade luxury timepieces — 1:1 super clones of the world\'s most iconic watches, inspected piece by piece and delivered across India with cash on delivery.',
  story: 'What began as a passion for horology grew into a mission: to make legendary watchmaking accessible without compromise. Every piece in our vault is measured against the original — weight, finish, movement sweep — before it earns the sabrXwatches name.',
  mission: 'To deliver impeccably crafted luxury timepieces with transparent pricing, honest quality checks, and service that treats every customer like a collector.',
  vision: 'To become India\'s most trusted destination for master copy watches — where craftsmanship, trust, and timeless style meet.',
  values: 'Precision Craftsmanship • Absolute Transparency • Collector-Grade 1:1 Perfection • Pan-India Doorstep Trust',
  owner: {
    name: 'Founder Name',
    role: 'Founder & CEO',
    bio: 'Drives the brand vision, curates the collection, and sets the quality standard every watch must meet.',
    longBio: 'With over a decade of horological appreciation, our founder established sabrXwatches to bring master-grade timepieces to Indian collectors without exorbitant markups.',
    photoUrl: '',
    enabled: true,
    social: { instagram: '', twitter: '', linkedin: '', email: '', phone: '' }
  },
  sections: [
    { key: 'intro',    label: 'Brand Introduction', enabled: true, order: 1 },
    { key: 'story',    label: 'Our Story',          enabled: true, order: 2 },
    { key: 'mission',  label: 'Mission & Vision',   enabled: true, order: 3 },
    { key: 'values',   label: 'Core Values',        enabled: true, order: 4 },
    { key: 'owner',    label: 'Founder Profile',    enabled: true, order: 5 },
    { key: 'team',     label: 'Meet The Team',      enabled: true, order: 6 },
    { key: 'quality',  label: 'Quality Standard',   enabled: true, order: 7 },
    { key: 'whoIsWho', label: 'Who Is Who',         enabled: true, order: 8 }
  ],
  team: [
    { key: 'founder',   name: 'Founder Name',   role: 'Founder & CEO',       bio: 'Drives the brand vision, curates the collection, and sets the quality standard every watch must meet.', photoUrl: '', enabled: true, order: 1, social: { instagram: '', twitter: '', linkedin: '', email: '' } },
    { key: 'developer', name: 'Developer Name', role: 'Lead Developer',      bio: 'Builds and maintains the website, checkout, order tracking, and every digital experience you use.',   photoUrl: '', enabled: true, order: 2, social: { instagram: '', twitter: '', linkedin: '', email: '' } },
    { key: 'manager',   name: 'Manager Name',   role: 'Operations Manager',  bio: 'Runs day-to-day operations — inventory, dispatch, support, and making sure your order reaches you fast.', photoUrl: '', enabled: true, order: 3, social: { instagram: '', twitter: '', linkedin: '', email: '' } }
  ],
  whoIsWho: [
    { role: 'founder',   title: 'The Founder',        description: 'The Founder owns the brand and business direction — choosing which timepieces enter the collection, setting pricing and quality policy, and steering sabrXwatches\'s growth.', enabled: true, order: 1 },
    { role: 'developer', title: 'The Developer',      description: 'The Developer builds and maintains the software behind the store — the website, shopping cart, secure checkout, order tracking, and the Admin Panel used to manage everything.', enabled: true, order: 2 },
    { role: 'manager',   title: 'The Manager',        description: 'The Manager runs operations — stock and inventory, packing and dispatch, customer support, returns and replacements — so every order is fulfilled smoothly.', enabled: true, order: 3 }
  ],
  updatedAt: null
};

// =====================================================
// MONGOOSE SCHEMAS & MODELS (Permanent Cloud Database)
// =====================================================
const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  brand: { type: String, index: true },
  model: String,
  tagline: String,
  price: Number,
  originalPrice: Number,
  rating: { type: Number, default: 4.9 },
  reviewsCount: { type: Number, default: 50 },
  badge: { type: String, default: '1:1 MASTER' },
  category: { type: String, index: true },
  movement: String,
  dialSize: String,
  glass: String,
  strap: String,
  dialColor: String,
  caseColor: String,
  caseMaterial: String,
  strapColor: String,
  dialShape: String,
  waterResistance: String,
  image: String,
  additionalImages: [String],
  videoUrl: String,
  description: String,
  features: [String],
  isBestSeller: { type: Boolean, default: false, index: true },
  isNewArrival: { type: Boolean, default: false, index: true },
  isTrending: { type: Boolean, default: false, index: true },
  isHidden: { type: Boolean, default: false, index: true },
  stock: { type: Number, default: 20 },
  discount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.index({ isHidden: 1, createdAt: -1 });
productSchema.index({ isHidden: 1, category: 1, createdAt: -1 });

const brandingSchema = new mongoose.Schema({
  storeName: { type: String, default: 'sabrXwatches' },
  tagline: { type: String, default: 'Timeless Elegance - Master Copy Watches' },
  logoUrl: { type: String, default: '' },
  faviconUrl: { type: String, default: '' },
  storePhone: { type: String, default: '919876543210' },
  announcementText: { type: String, default: '' },
  coinEarnRate: { type: Number, default: 1 },
  coinRedeemRate: { type: Number, default: 1 },
  adminPasskey: { type: String, default: ADMIN_PASSKEY },
  isCatalogInitialized: { type: Boolean, default: true }
});

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  slug: String,
  icon: String,
  sortOrder: Number
});

const heroBannerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: String,
  subtitle: String,
  badge: String,
  buttonText: String,
  buttonLink: String,
  imageUrl: String,
  active: { type: Boolean, default: true }
});

// Admin-manageable order lifecycle.
const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned'];

// Delivery dates are stored as a plain calendar string (YYYY-MM-DD), never as a Date:
// a UTC-anchored Date renders as the previous day for IST users, which shifted dates by one.
function normalizeCalendarDate(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d ? s : null;
}

function calendarDateFromToday(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  userId: String,
  customerName: String,
  customerEmail: String,
  phone: String,
  altPhone: String,
  address: String,
  landmark: String,
  city: String,
  state: String,
  pincode: String,
  deliveryLocation: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    address: String,
    city: String,
    state: String,
    pincode: String
  },
  locationCapturedAt: Date,
  items: Array,
  subtotal: Number,
  discount: Number,
  couponDiscount: { type: Number, default: 0 },
  couponCode: { type: String, default: '' },
  coinsUsed: { type: Number, default: 0 },
  coinDiscount: { type: Number, default: 0 },
  coinsEarned: { type: Number, default: 0 },
  total: Number,
  shippingCharge: { type: Number, default: 0 },
  paymentMethod: { type: String, default: 'Cash on Delivery (COD)' },
  status: { type: String, default: 'Pending', index: true },
  // Calendar string (YYYY-MM-DD) so the customer and the admin always read the same day.
  expectedDeliveryDate: { type: String, default: '' },
  trackingTimeline: [
    {
      status: String,
      timestamp: { type: Date, default: Date.now },
      message: String
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: String,
  email: { type: String, required: true, unique: true },
  password: String,
  phone: String,
  authProvider: { type: String, default: 'email' },
  avatar: String,
  coinBalance: { type: Number, default: 50 },
  totalSpent: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  address: String,
  landmark: String,
  city: String,
  state: String,
  pincode: String,
  status: { type: String, default: 'Active', index: true },
  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountType: { type: String, default: 'flat' },
  discountValue: { type: Number, required: true },
  minOrder: { type: Number, default: 0 },
  expiryDate: String,
  usageLimit: { type: Number, default: 1000 },
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const coinSchema = new mongoose.Schema({
  userId: String,
  orderId: String,
  type: { type: String, enum: ['credit', 'debit'] },
  amount: Number,
  description: String,
  createdAt: { type: Date, default: Date.now }
});

const reviewSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  productId: String,
  customerName: String,
  rating: Number,
  title: String,
  comment: String,
  imageUrl: String,
  verifiedPurchase: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  title: String,
  message: String,
  type: { type: String, default: 'order' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const aboutMemberSchema = new mongoose.Schema({
  key: String,
  name: String,
  role: String,
  bio: String,
  photoUrl: String,
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  social: { instagram: String, twitter: String, linkedin: String, email: String }
}, { _id: false });

const aboutSectionSchema = new mongoose.Schema({
  key: String,
  label: String,
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { _id: false });

const aboutWhoSchema = new mongoose.Schema({
  role: String,
  title: String,
  description: String,
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { _id: false });

const aboutSchema = new mongoose.Schema({
  pageTitle: { type: String, default: 'About Us' },
  intro: { type: String, default: '' },
  story: { type: String, default: '' },
  mission: { type: String, default: '' },
  vision: { type: String, default: '' },
  values: { type: String, default: '' },
  quality: { type: String, default: '' },
  owner: { type: Object, default: () => ({ ...DEFAULT_ABOUT.owner }) },
  sections: { type: [aboutSectionSchema], default: DEFAULT_ABOUT.sections },
  team: { type: [aboutMemberSchema], default: DEFAULT_ABOUT.team },
  whoIsWho: { type: [aboutWhoSchema], default: DEFAULT_ABOUT.whoIsWho },
  updatedAt: { type: Date, default: Date.now }
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
const Branding = mongoose.models.Branding || mongoose.model('Branding', brandingSchema);
const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
const HeroBanner = mongoose.models.HeroBanner || mongoose.model('HeroBanner', heroBannerSchema);
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
const Coin = mongoose.models.Coin || mongoose.model('Coin', coinSchema);
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
const About = mongoose.models.About || mongoose.model('About', aboutSchema);

// =====================================================
// MONGOOSE CACHED CONNECTION (Vercel Serverless + Production Engine)
// =====================================================
let cachedMongo = global.mongoose;
if (!cachedMongo) {
  cachedMongo = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    const err = new Error('MONGO_URI is missing from environment variables');
    err.code = 'MONGO_URI_MISSING';
    throw err;
  }

  if (cachedMongo.conn && mongoose.connection.readyState === 1) {
    return cachedMongo.conn;
  }

  if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    cachedMongo.conn = null;
    cachedMongo.promise = null;
  }

  if (!cachedMongo.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10
    };

    const sanitizedUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`🔄 Establishing cached MongoDB Atlas connection: ${sanitizedUri}...`);

    cachedMongo.promise = mongoose.connect(uri, opts).then((m) => {
      console.log('✅ MongoDB Atlas connected successfully! (Cached Connection)');
      return m;
    }).catch((err) => {
      cachedMongo.promise = null;
      console.error('🚨 MongoDB Atlas Connection Error:', err.message);
      throw err;
    });
  }

  try {
    cachedMongo.conn = await cachedMongo.promise;
  } catch (e) {
    cachedMongo.promise = null;
    throw e;
  }

  return cachedMongo.conn;
}

// Backward-compatible alias
const initMongo = connectToDatabase;

// Unified Pure-Mongoose CRUD Layer (No NeDB Fallback)
const DB = {
  // Products
  async getProducts(query = {}) {
    return await Product.find(query).lean();
  },
  async getProductById(id) {
    return await Product.findOne({ id }).lean();
  },
  async addProduct(doc) {
    return await Product.create(doc);
  },
  async findByBrandModel(brand, model) {
    const rx = (v) => new RegExp(`^${String(v || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    return await Product.findOne({ brand: rx(brand), model: rx(model) }).lean();
  },
  async updateProduct(id, updates) {
    delete updates._id;
    updates.updatedAt = new Date();
    return await Product.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
  },
  async deleteProduct(id) {
    const res = await Product.deleteOne({ id });
    return res.deletedCount > 0;
  },
  async countProducts(q = {}) {
    return await Product.countDocuments(q);
  },

  // Branding / Settings
  // Pinned to the earliest document: the collection has more than one branding row,
  // and an unsorted findOne() can hand back a different one on each call — which made
  // settings (and the admin passkey) look like they changed at random.
  async getBranding() {
    let b = await Branding.findOne().sort({ _id: 1 }).lean();
    if (!b) {
      b = await Branding.create(INITIAL_SETTINGS);
    }
    return b;
  },
  async updateBranding(updates) {
    delete updates._id;
    let b = await Branding.findOne().sort({ _id: 1 });
    if (!b) {
      return await Branding.create({ ...INITIAL_SETTINGS, ...updates });
    }
    Object.assign(b, updates);
    await b.save();
    return b.toObject();
  },

  // Orders
  async getOrders(q = {}) {
    return await Order.find(q).sort({ createdAt: -1 }).lean();
  },
  async getOrderById(orderId) {
    return await Order.findOne({ orderId }).lean();
  },
  async addOrder(doc) {
    return await Order.create(doc);
  },
  async updateOrderStatus(orderId, status, message) {
    const trackingEntry = {
      status,
      timestamp: new Date(),
      message: message || `Order status updated to ${status}`
    };
    return await Order.findOneAndUpdate(
      { orderId },
      {
        $set: { status, updatedAt: new Date() },
        $push: { trackingTimeline: trackingEntry }
      },
      { new: true }
    ).lean();
  },
  // Expected delivery date is stored as a plain calendar string (YYYY-MM-DD) so that no
  // timezone conversion can shift it by a day, and so orders created before this field
  // existed keep working — an empty string simply means "not promised yet".
  async updateOrderDeliveryDate(orderId, expectedDeliveryDate) {
    return await Order.findOneAndUpdate(
      { orderId },
      { $set: { expectedDeliveryDate, updatedAt: new Date() } },
      { new: true }
    ).lean();
  },
  async appendOrderEvent(orderId, entry) {
    return await Order.findOneAndUpdate(
      { orderId },
      { $push: { trackingTimeline: entry } },
      { new: true }
    ).lean();
  },
  async deleteOrder(orderId) {
    const res = await Order.deleteOne({ orderId });
    return res.deletedCount > 0;
  },
  async countOrders(q = {}) {
    return await Order.countDocuments(q);
  },

  // Users
  async getUsers(q = {}) {
    return await User.find(q).select('-password').sort({ createdAt: -1 }).lean();
  },
  async getUserById(userId) {
    return await User.findOne({ userId }).lean();
  },
  async getUserByEmail(email) {
    const clean = email.trim().toLowerCase();
    return await User.findOne({ email: clean }).lean();
  },
  async addUser(doc) {
    const created = await User.create(doc);
    return created.toObject({ versionKey: false });
  },
  async updateUser(userId, updates) {
    delete updates._id;
    delete updates.password;
    return await User.findOneAndUpdate({ userId }, { $set: updates }, { new: true }).select('-password').lean();
  },
  async deleteUser(userId) {
    const res = await User.deleteOne({ userId });
    return res.deletedCount > 0;
  },
  async countUsers(q = {}) {
    return await User.countDocuments(q);
  },

  // Categories
  async getCategories() {
    return await Category.find().sort({ sortOrder: 1 }).lean();
  },
  async addCategory(doc) {
    return await Category.create(doc);
  },
  async deleteCategory(id) {
    const res = await Category.deleteOne({ id });
    return res.deletedCount > 0;
  },

  // Coupons
  async getCoupons() {
    return await Coupon.find().lean();
  },
  async getCouponByCode(code) {
    const clean = code.trim().toUpperCase();
    return await Coupon.findOne({ code: clean }).lean();
  },
  async addCoupon(doc) {
    doc.code = doc.code.trim().toUpperCase();
    return await Coupon.create(doc);
  },
  async deleteCoupon(code) {
    const clean = code.trim().toUpperCase();
    const res = await Coupon.deleteOne({ code: clean });
    return res.deletedCount > 0;
  },

  // Coins
  async logCoinTransaction(doc) {
    return await Coin.create(doc);
  },
  async getCoinHistory(userId) {
    return await Coin.find({ userId }).sort({ createdAt: -1 }).lean();
  },

  // Notifications
  async addNotification(doc) {
    return await Notification.create(doc);
  },
  async getNotifications(userId) {
    return await Notification.find({ userId }).sort({ createdAt: -1 }).lean();
  },

  // About Us
  async getAboutUs() {
    let a = await About.findOne().lean();
    if (!a) a = await About.create(DEFAULT_ABOUT);
    return a;
  },
  async updateAboutUs(updates) {
    delete updates._id;
    updates.updatedAt = new Date();
    let a = await About.findOne();
    if (!a) return await About.create({ ...DEFAULT_ABOUT, ...updates });
    Object.assign(a, updates);
    await a.save();
    return a.toObject();
  }
};

// =====================================================
// SEED DATABASE (Run only if database is completely empty and uninitialized)
// =====================================================
async function seedInitialOnce() {
  try {
    if (mongoose.connection.readyState !== 1) {
      return;
    }
    const branding = await DB.getBranding();
    if (branding && branding.isCatalogInitialized) {
      // Catalog has already been initialized previously.
      // NEVER auto-seed or restore deleted products!
      return;
    }

    const count = await DB.countProducts();
    if (count === 0 && (!branding || !branding.isCatalogInitialized)) {
      console.log('🌱 Performing one-time initialization of catalog...');
      for (const p of INITIAL_PRODUCTS) {
        await DB.addProduct(p);
      }
      for (const c of INITIAL_CATEGORIES) {
        await DB.addCategory(c);
      }
      await DB.updateBranding({ isCatalogInitialized: true });
      console.log('✅ Initial catalog seeded. Further deletes are permanent.');
    }
  } catch (err) {
    console.error('Seed check error:', err.message);
  }
}

// =====================================================
// API CACHE-CONTROL & DATABASE CONNECTION MIDDLEWARE
// =====================================================
app.use('/api', async (req, res, next) => {
  // Prevent browser/proxy caching for real-time persistence
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  // Health endpoint handles its own connection diagnostics
  if (req.path === '/health') {
    return next();
  }

  try {
    await connectToDatabase();
    next();
  } catch (err) {
    const isMissingUri = err.code === 'MONGO_URI_MISSING' || (!process.env.MONGO_URI && !process.env.MONGODB_URI);
    return res.status(503).json({
      error: 'Database connection unavailable',
      message: isMissingUri 
        ? 'MONGO_URI is missing in Vercel environment variables.' 
        : 'Could not connect to MongoDB Atlas cluster.',
      connected: false
    });
  }
});

// =====================================================
// REST API ROUTES
// =====================================================

// Real Database Health Check (Actual Ping Verification)
app.get('/api/health', async (req, res) => {
  let isConnected = false;
  try {
    await connectToDatabase();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      isConnected = true;
    }
  } catch (e) {
    isConnected = false;
  }

  if (isConnected) {
    try {
      const [productsCount, ordersCount, usersCount] = await Promise.all([
        DB.countProducts(),
        DB.countOrders(),
        DB.countUsers()
      ]);
      return res.json({
        status: 'ok',
        database: 'MongoDB Atlas — Connected',
        connected: true,
        products: productsCount,
        orders: ordersCount,
        customers: usersCount,
        uptime: Math.round(process.uptime()) + 's'
      });
    } catch (e) {
      return res.status(500).json({
        status: 'error',
        database: 'MongoDB Atlas — Disconnected',
        connected: false,
        error: 'Database query error'
      });
    }
  } else {
    return res.status(503).json({
      status: 'disconnected',
      database: 'MongoDB Atlas — Disconnected',
      connected: false,
      error: 'MongoDB Atlas is disconnected. Please check MONGO_URI.'
    });
  }
});

// Admin Passkey Helpers
// The passkey stored in MongoDB is what the "Change Passkey" form updates, so it
// must be honoured. The ENV var stays as a master override so production can never
// be locked out by a bad DB value. Whichever of the two the admin typed is trimmed
// before comparing — a stray trailing space used to read as "incorrect".
async function getAdminPasskeys() {
  const keys = new Set();
  try {
    const b = await DB.getBranding();
    if (b && b.adminPasskey) keys.add(String(b.adminPasskey).trim());
  } catch (e) { /* fall back to env */ }
  if (process.env.ADMIN_PASSKEY) keys.add(String(process.env.ADMIN_PASSKEY).trim());
  if (keys.size === 0) keys.add(ADMIN_PASSKEY);
  keys.delete('');
  return keys;
}

function isAdminPasskey(key) {
  if (!key) return Promise.resolve(false);
  return getAdminPasskeys().then((keys) => keys.has(String(key).trim()));
}

// Admin route protection — mutating admin endpoints require a valid passkey header
async function adminAuth(req, res, next) {
  try {
    if (await isAdminPasskey(req.headers['x-admin-passkey'])) return next();
    return res.status(401).json({ error: 'Unauthorized: invalid admin credentials' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// Admin Auth Verify
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { passkey } = req.body;
    if (await isAdminPasskey(passkey)) return res.json({ success: true });
    res.status(401).json({ success: false, error: 'Invalid admin passkey' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin Change Passkey
app.post('/api/auth/change-passkey', adminAuth, async (req, res) => {
  try {
    const { currentPasskey, newPasskey } = req.body;
    const next = (newPasskey || '').trim();
    if (next.length < 4) {
      return res.status(400).json({ error: 'New passkey must be at least 4 characters long.' });
    }
    const keys = await getAdminPasskeys();
    if (!keys.has((currentPasskey || '').trim())) {
      return res.status(401).json({ error: 'Current passkey is incorrect.' });
    }
    await DB.updateBranding({ adminPasskey: next });
    res.json({ success: true, message: 'Admin passkey updated permanently! 🔒' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── BRANDING & SETTINGS ─────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    const b = await DB.getBranding();
    const safe = { ...b };
    delete safe.adminPasskey;
    res.json(safe);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/settings', adminAuth, async (req, res) => {
  try {
    const { storeName, tagline, storePhone, announcementText, faviconUrl, coinEarnRate, coinRedeemRate } = req.body;
    const updated = await DB.updateBranding({
      ...(storeName !== undefined && { storeName }),
      ...(tagline !== undefined && { tagline }),
      ...(storePhone !== undefined && { storePhone }),
      ...(announcementText !== undefined && { announcementText }),
      ...(faviconUrl !== undefined && { faviconUrl }),
      ...(coinEarnRate !== undefined && { coinEarnRate: Number(coinEarnRate) }),
      ...(coinRedeemRate !== undefined && { coinRedeemRate: Number(coinRedeemRate) })
    });
    const safe = { ...updated };
    delete safe.adminPasskey;
    res.json({ success: true, settings: safe });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Logo Upload
app.post('/api/settings/logo', adminAuth, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logoUrl = `/uploads/${req.file.filename}`;
    await DB.updateBranding({ logoUrl });
    res.json({ success: true, logoUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove Logo Permanently
app.delete('/api/settings/logo', adminAuth, async (req, res) => {
  try {
    await DB.updateBranding({ logoUrl: '' });
    res.json({ success: true, message: 'Logo removed permanently. Default monogram will display.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ABOUT US (Storefront page content) ──────────────
// Public read — powers about.html (no mock data: real DB or error state)
app.get('/api/about', async (req, res) => {
  try {
    const about = await DB.getAboutUs();
    res.json(about);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin-only update of About Us content (Supports PUT & POST)
const handleAboutUpdate = async (req, res) => {
  try {
    const { pageTitle, intro, story, mission, vision, values, quality, owner, sections, team, whoIsWho } = req.body;
    const updates = {
      ...(pageTitle !== undefined && { pageTitle: String(pageTitle).slice(0, 200) }),
      ...(intro !== undefined && { intro: String(intro).slice(0, 5000) }),
      ...(story !== undefined && { story: String(story).slice(0, 5000) }),
      ...(mission !== undefined && { mission: String(mission).slice(0, 5000) }),
      ...(vision !== undefined && { vision: String(vision).slice(0, 5000) }),
      ...(values !== undefined && { values: String(values).slice(0, 5000) }),
      ...(quality !== undefined && { quality: String(quality).slice(0, 5000) }),
      ...(owner !== undefined && typeof owner === 'object' && { owner }),
      ...(Array.isArray(sections) && { sections: sections.slice(0, 30) }),
      ...(Array.isArray(team) && { team: team.slice(0, 50) }),
      ...(Array.isArray(whoIsWho) && { whoIsWho: whoIsWho.slice(0, 30) })
    };
    const updated = await DB.updateAboutUs(updates);
    res.json({ success: true, about: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

app.put('/api/about', adminAuth, handleAboutUpdate);
app.post('/api/about', adminAuth, handleAboutUpdate);

// Team/Owner member photo upload — returns data URL for permanent MongoDB storage across Vercel redeploys
app.post('/api/about/photo', adminAuth, uploadPhoto.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
    let photoUrl = `/uploads/${req.file.filename}`;
    try {
      const buffer = fs.readFileSync(req.file.path);
      const mime = req.file.mimetype || 'image/jpeg';
      photoUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (e) {}
    res.json({ success: true, photoUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PRODUCTS ────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, sort, includeHidden } = req.query;
    const filter = {};

    // Storefront does not see hidden products unless explicitly requested by admin
    if (includeHidden !== 'true') {
      filter.isHidden = { $ne: true };
    }

    if (category && category !== 'all') {
      filter.category = category.toLowerCase().trim();
    }

    if (search) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { brand: regex },
        { model: regex },
        { tagline: regex },
        { movement: regex }
      ];
    }

    let queryBuilder = Product.find(filter);

    if (sort === 'price-low') queryBuilder = queryBuilder.sort({ price: 1 });
    else if (sort === 'price-high') queryBuilder = queryBuilder.sort({ price: -1 });
    else if (sort === 'rating') queryBuilder = queryBuilder.sort({ rating: -1 });
    else if (sort === 'newest') queryBuilder = queryBuilder.sort({ createdAt: -1 });
    else queryBuilder = queryBuilder.sort({ createdAt: -1 });

    const products = await queryBuilder.lean();
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const p = await DB.getProductById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Watch not found' });
    res.json(p);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Specs must never be invented: an empty field stays "Not Specified" instead of a
// plausible-sounding default that would misdescribe the product.
const NOT_SPECIFIED = 'Not Specified';
// Neutral placeholder — never a real watch photo, so a product can never
// appear to carry another product's image.
const DEFAULT_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Crect width='240' height='240' fill='%230F172A'/%3E%3Ccircle cx='120' cy='126' r='52' fill='none' stroke='%23C9A96E' stroke-width='5'/%3E%3Cpath d='M120 96v32l20 12' fill='none' stroke='%23C9A96E' stroke-width='5' stroke-linecap='round'/%3E%3Ctext x='120' y='206' fill='%236B7280' font-family='sans-serif' font-size='13' text-anchor='middle'%3EImage unavailable%3C/text%3E%3C/svg%3E";
const spec = (v) => (v && String(v).trim()) || NOT_SPECIFIED;
const toImageList = (v) => {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v !== 'string' || !v.trim()) return [];
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (e) { /* fall through to line/comma separated */ }
  return v.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
};

app.post('/api/products', adminAuth, uploadMedia, async (req, res) => {
  try {
    const b = req.body;
    const files = req.files || {};

    let image = b.imageUrl || DEFAULT_IMAGE_PLACEHOLDER;
    if (files.image && files.image[0]) image = `/uploads/${files.image[0].filename}`;

    let videoUrl = b.videoUrl || '';
    if (files.video && files.video[0]) videoUrl = `/uploads/${files.video[0].filename}`;

    const brand = String(b.brand || '').trim() || 'Unbranded';
    const model = String(b.model || '').trim();

    const duplicate = await DB.findByBrandModel(brand, model);
    if (duplicate) {
      return res.status(409).json({
        error: `"${brand} ${model}" already exists in the catalog (ID ${duplicate.id}). Edit the existing watch or use a different model name — no duplicate was created.`
      });
    }

    const price = Number(b.price);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: 'A selling price above ₹0 is required — the watch was not created. Enter the real price instead of leaving it blank.' });
    }
    const originalPrice = Number(b.originalPrice);

    const product = {
      id: `amc-${Date.now().toString().slice(-8)}`,
      brand,
      model: model || 'Untitled Model',
      tagline: b.tagline || '',
      price,
      // A blank reference price means "same as selling price", never an invented MRP
      originalPrice: Number.isFinite(originalPrice) && originalPrice > 0 ? originalPrice : price,
      rating: Number(b.rating) || 0,
      reviewsCount: Number(b.reviewsCount) || 0,
      badge: (b.badge || 'NEW ARRIVAL').toUpperCase(),
      category: (b.category || 'other').toLowerCase(),
      movement: spec(b.movement),
      dialSize: spec(b.dialSize),
      glass: spec(b.glass),
      strap: spec(b.strap),
      dialColor: spec(b.dialColor),
      caseColor: spec(b.caseColor),
      caseMaterial: spec(b.caseMaterial),
      strapColor: spec(b.strapColor),
      dialShape: spec(b.dialShape),
      waterResistance: spec(b.waterResistance),
      description: b.description || '',
      features: Array.isArray(b.features)
        ? b.features
        : (b.features ? b.features.split('\n').map(f => f.trim()).filter(Boolean) : []),
      image,
      additionalImages: toImageList(b.additionalImages),
      videoUrl,
      isBestSeller: b.isBestSeller === 'true' || b.isBestSeller === true,
      isNewArrival: b.isNewArrival === 'true' || b.isNewArrival === true,
      isTrending: b.isTrending === 'true' || b.isTrending === true,
      isHidden: b.isHidden === 'true' || b.isHidden === true,
      stock: Number(b.stock) || 20,
      discount: Number(b.discount) || 0,
      createdAt: new Date().toISOString()
    };

    const saved = await DB.addProduct(product);
    res.status(201).json({ success: true, product: saved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/products/:id', adminAuth, uploadMedia, async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body;
    const files = req.files || {};
    const updates = { ...b };

    // An empty or non-numeric price used to be written straight through, which is how
    // products ended up showing ₹0 / blank after an edit. Reject it and keep the old value.
    for (const field of ['price', 'originalPrice']) {
      if (b[field] === undefined) continue;
      const value = Number(b[field]);
      if (!Number.isFinite(value) || value <= 0) {
        return res.status(400).json({ error: `"${field}" must be a number above ₹0. The existing price was left unchanged.` });
      }
      updates[field] = value;
    }
    if (updates.rating) updates.rating = Number(updates.rating);
    if (updates.reviewsCount) updates.reviewsCount = Number(updates.reviewsCount);
    if (updates.stock !== undefined) updates.stock = Number(updates.stock);
    if (updates.discount !== undefined) updates.discount = Number(updates.discount);

    if (updates.isBestSeller !== undefined) updates.isBestSeller = updates.isBestSeller === 'true' || updates.isBestSeller === true;
    if (updates.isNewArrival !== undefined) updates.isNewArrival = updates.isNewArrival === 'true' || updates.isNewArrival === true;
    if (updates.isTrending !== undefined) updates.isTrending = updates.isTrending === 'true' || updates.isTrending === true;
    if (updates.isHidden !== undefined) updates.isHidden = updates.isHidden === 'true' || updates.isHidden === true;

    if (files.image && files.image[0]) updates.image = `/uploads/${files.image[0].filename}`;
    else if (b.imageUrl) updates.image = b.imageUrl;
    delete updates.imageUrl;

    if (files.video && files.video[0]) updates.videoUrl = `/uploads/${files.video[0].filename}`;
    else if (b.videoUrl !== undefined) updates.videoUrl = b.videoUrl;

    if (b.additionalImages !== undefined) updates.additionalImages = toImageList(b.additionalImages);

    for (const field of ['movement', 'dialSize', 'glass', 'strap', 'dialColor', 'caseColor', 'caseMaterial', 'strapColor', 'dialShape', 'waterResistance']) {
      if (updates[field] !== undefined) updates[field] = spec(updates[field]);
    }
    if (updates.brand !== undefined) updates.brand = String(updates.brand).trim() || 'Unbranded';

    if (updates.brand && updates.model) {
      const clash = await DB.findByBrandModel(updates.brand, updates.model);
      if (clash && clash.id !== id) {
        return res.status(409).json({
          error: `"${updates.brand} ${updates.model}" already belongs to another product (ID ${clash.id}). No changes were saved.`
        });
      }
    }

    if (typeof updates.features === 'string') {
      updates.features = updates.features.split('\n').map(f => f.trim()).filter(Boolean);
    }

    const updated = await DB.updateProduct(id, updates);
    if (!updated) return res.status(404).json({ error: 'Watch not found' });
    res.json({ success: true, product: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Permanently Delete Product
app.delete('/api/products/:id', adminAuth, async (req, res) => {
  try {
    const success = await DB.deleteProduct(req.params.id);
    if (!success) return res.status(404).json({ error: 'Watch not found or already deleted' });
    res.json({ success: true, message: 'Watch permanently deleted from database.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Toggle Product Flag (Hidden, Best Seller, New Arrival, Trending)
app.patch('/api/products/:id/toggle', adminAuth, async (req, res) => {
  try {
    const { field } = req.body;
    const allowed = ['isHidden', 'isBestSeller', 'isNewArrival', 'isTrending'];
    if (!allowed.includes(field)) return res.status(400).json({ error: 'Invalid field' });

    const p = await DB.getProductById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Watch not found' });

    const newVal = !p[field];
    const updated = await DB.updateProduct(req.params.id, { [field]: newVal });
    res.json({ success: true, field, value: newVal, product: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bulk Catalog Upload — CSV/Excel rows arrive as JSON objects from the admin panel.
// Existing single-product routes are untouched; duplicates are skipped, never created.
app.post('/api/products/bulk', adminAuth, async (req, res) => {
  try {
    const rows = Array.isArray(req.body.products) ? req.body.products : [];
    if (!rows.length) return res.status(400).json({ error: 'No product rows received' });
    if (rows.length > 200) return res.status(400).json({ error: 'Maximum 200 products per bulk upload' });

    const created = [], skipped = [], invalid = [];

    for (const [i, r] of rows.entries()) {
      const brand = String(r.brandName || r.brand || '').trim() || 'Unbranded';
      const model = String(r.productName || r.model || r.modelName || '').trim();
      if (!model) { invalid.push({ row: i + 1, error: 'Missing product name' }); continue; }

      const price = Number(r.sellingPrice || r.price) || 0;
      if (price <= 0) { invalid.push({ row: i + 1, error: 'Missing or invalid selling price' }); continue; }

      const exists = await DB.findByBrandModel(brand, model);
      if (exists) { skipped.push({ row: i + 1, brand, model, id: exists.id, reason: 'already in catalog' }); continue; }

      const product = {
        id: `amc-${Date.now().toString().slice(-8)}-${i}`,
        brand,
        model,
        tagline: String(r.tagline || '').trim(),
        price,
        originalPrice: Number(r.referenceMRP || r.originalPrice) || price,
        rating: 4.9,
        reviewsCount: 0,
        badge: String(r.badge || 'NEW ARRIVAL').toUpperCase(),
        category: (r.category || 'other').toLowerCase().trim(),
        movement: spec(r.movement),
        dialSize: spec(r.dialDiameter || r.dialSize),
        glass: spec(r.glassMaterial || r.glass),
        strap: spec(r.strapMaterial || r.strap),
        dialColor: spec(r.dialColor),
        caseColor: spec(r.caseColor),
        caseMaterial: spec(r.caseMaterial),
        strapColor: spec(r.strapColor),
        dialShape: spec(r.dialShape),
        waterResistance: spec(r.waterResistance),
        description: String(r.description || '').trim(),
        features: Array.isArray(r.keyFeatures) ? r.keyFeatures
          : String(r.keyFeatures || '').split(/[;|\n]/).map(s => s.trim()).filter(Boolean),
        image: String(r.image || '').trim() || DEFAULT_IMAGE_PLACEHOLDER,
        additionalImages: toImageList(r.additionalImages),
        stock: Number(r.stockCount || r.stock) || 0,
        discount: 0,
        createdAt: new Date().toISOString()
      };

      const saved = await DB.addProduct(product);
      created.push({ row: i + 1, id: saved.id, brand, model });
    }

    res.status(201).json({ success: true, created, skipped, invalid, total: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Manual Seed Initial Defaults (Admin action only)
app.post('/api/admin/seed-defaults', adminAuth, async (req, res) => {
  try {
    for (const p of INITIAL_PRODUCTS) {
      const exists = await DB.getProductById(p.id);
      if (!exists) {
        await DB.addProduct(p);
      }
    }
    const all = await DB.getProducts();
    res.json({ success: true, message: 'Curated master collection populated!', count: all.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ORDERS & CHECKOUT ───────────────────────────────
// Admin-only: orders may contain GPS delivery coordinates (privacy requirement)
app.get('/api/orders', adminAuth, async (req, res) => {
  try {
    const orders = await DB.getOrders();
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const b = req.body;
    const orderId = b.orderId || `AMC-${Math.floor(10000 + Math.random() * 90000)}`;
    const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

    const customerName = clean(b.customerName || (b.customer && b.customer.fullName), 120);
    const phone = clean(b.phone || (b.customer && b.customer.phone), 20);
    const address = clean(b.address || (b.customer && b.customer.address), 500);
    const city = clean(b.city || (b.customer && b.customer.city), 100);
    const state = clean(b.state || (b.customer && b.customer.state), 100);
    const pincode = clean(b.pincode || (b.customer && b.customer.pincode), 10);

    // A courier only needs a deliverable address, so the address block is mandatory.
    const missing = [];
    if (!customerName) missing.push('full name');
    if (!/^\d{10}$/.test(phone.replace(/\D/g, ''))) missing.push('a valid 10-digit mobile number');
    if (!address) missing.push('address');
    if (!city) missing.push('city');
    if (!state) missing.push('state');
    if (!/^\d{6}$/.test(pincode)) missing.push('a valid 6-digit pincode');
    if (missing.length) {
      return res.status(400).json({ error: `Please complete the delivery details: ${missing.join(', ')}.` });
    }

    // Line items are rebuilt from MongoDB so an order always records the real catalogue
    // name and selling price at purchase time — never a browser-supplied ₹0.
    const rawItems = Array.isArray(b.items) ? b.items : [];
    if (rawItems.length === 0) return res.status(400).json({ error: 'Your cart is empty — there is nothing to order.' });
    const items = [];
    for (const it of rawItems) {
      const product = await DB.getProductById(clean(it.id, 80));
      if (!product || product.isHidden) {
        return res.status(400).json({ error: 'One of the watches in your cart is no longer available. Please refresh the page and try again.' });
      }
      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return res.status(400).json({ error: `${product.brand} ${product.model} does not have a valid price yet. Please contact us before ordering.` });
      }
      items.push({
        id: product.id,
        brand: product.brand,
        model: product.model,
        name: `${product.brand} ${product.model}`,
        price: unitPrice,
        // Catalogue images are often embedded base64 blobs — copying those into every order
        // would bloat the record. Store a URL when there is one; the UI falls back to the
        // live catalog by product id, then to a placeholder.
        image: typeof product.image === 'string' && !product.image.startsWith('data:') ? product.image.slice(0, 300) : '',
        quantity: Math.min(50, Math.max(1, Math.floor(Number(it.quantity) || 1)))
      });
    }

    const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const discount = Math.max(0, Number(b.discount) || 0);
    const couponDiscount = Math.max(0, Number(b.couponDiscount) || 0);
    const coinDiscount = Math.max(0, Number(b.coinDiscount) || 0);
    const coinsUsed = Math.max(0, Math.floor(Number(b.coinsUsed) || 0));
    const shippingCharge = Math.max(0, Number(b.shippingCharge) || 0);
    const totalAmount = Math.max(0, subtotal - discount - couponDiscount - coinDiscount + shippingCharge);
    if (!(totalAmount > 0)) return res.status(400).json({ error: 'The order total must be above ₹0.' });

    const branding = await DB.getBranding();
    const earnRate = branding.coinEarnRate || 1; // 1 coin per 100 spent
    const coinsEarned = Math.floor(totalAmount / 100) * earnRate;

    const newOrder = {
      orderId,
      userId: clean(b.userId || (b.customer && b.customer.userId), 60),
      customerName,
      customerEmail: clean(b.customerEmail || (b.customer && b.customer.customerEmail), 160).toLowerCase(),
      phone,
      altPhone: clean(b.altPhone || (b.customer && b.customer.altPhone), 20),
      address,
      landmark: clean(b.landmark || (b.customer && b.customer.landmark), 240),
      city,
      state,
      pincode,
      items,
      subtotal,
      discount,
      couponDiscount,
      couponCode: clean(b.couponCode, 60),
      coinsUsed,
      coinDiscount,
      coinsEarned,
      total: totalAmount,
      shippingCharge: Number(b.shippingCharge) || 0,
      paymentMethod: 'Cash on Delivery (COD)',
      status: 'Pending',
      expectedDeliveryDate: normalizeCalendarDate(b.expectedDeliveryDate) || calendarDateFromToday(7),
      trackingTimeline: [
        {
          status: 'Pending',
          timestamp: new Date().toISOString(),
          message: 'Order received. Our team will confirm your Cash on Delivery order before dispatch.'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await DB.addOrder(newOrder);

    // Sync with User document: Update coins, totalSpent, and totalOrders
    const userIdentifier = newOrder.customerEmail || newOrder.userId;
    if (userIdentifier) {
      let user = null;
      if (newOrder.customerEmail) user = await DB.getUserByEmail(newOrder.customerEmail);
      if (!user && newOrder.userId) user = await DB.getUserById(newOrder.userId);

      if (user) {
        let currentCoins = user.coinBalance || 0;
        // Deduct coins used
        currentCoins = Math.max(0, currentCoins - coinsUsed);
        // Credit earned coins
        currentCoins += coinsEarned;

        await DB.updateUser(user.userId, {
          coinBalance: currentCoins,
          totalSpent: (user.totalSpent || 0) + totalAmount,
          totalOrders: (user.totalOrders || 0) + 1,
          lastOrderDate: new Date().toISOString()
        });

        // Log coin transactions
        if (coinsUsed > 0) {
          await DB.logCoinTransaction({
            userId: user.userId,
            orderId,
            type: 'debit',
            amount: coinsUsed,
            description: `Redeemed ₹${coinDiscount} discount on order #${orderId}`,
            createdAt: new Date().toISOString()
          });
        }
        if (coinsEarned > 0) {
          await DB.logCoinTransaction({
            userId: user.userId,
            orderId,
            type: 'credit',
            amount: coinsEarned,
            description: `Reward for order #${orderId}`,
            createdAt: new Date().toISOString()
          });
        }

        // Send confirmation notification
        await DB.addNotification({
          id: `notif-${Date.now()}`,
          userId: user.userId,
          title: '🎉 Order Received!',
          message: `Order #${orderId} for ₹${totalAmount.toLocaleString('en-IN')} has been placed. You earned +${coinsEarned} AM Coins!`,
          type: 'order',
          createdAt: new Date().toISOString()
        });
      }
    }

    res.status(201).json({
      success: true,
      order: saved,
      coinsEarned,
      message: 'Cash on Delivery order received. We will confirm it with you shortly.'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function notifyOrderCustomer(order, title, message) {
  if (!order) return;
  try {
    const user = order.userId ? await DB.getUserById(order.userId) : null;
    const target = user || (order.customerEmail ? await DB.getUserByEmail(order.customerEmail) : null);
    if (!target) return;
    await DB.addNotification({
      id: `notif-${Date.now()}`,
      userId: target.userId,
      title,
      message,
      type: 'order',
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('Order notification failed:', e.message);
  }
}

// Update Order Status (Admin)
app.patch('/api/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, message } = req.body;
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid order status. Use one of: ${ORDER_STATUSES.join(', ')}` });
    }
    const updated = await DB.updateOrderStatus(id, status, message);
    if (!updated) return res.status(404).json({ error: 'Order not found' });

    await notifyOrderCustomer(
      updated,
      `Order #${id} Updated`,
      `Your order status is now: ${status}.` + (updated.expectedDeliveryDate ? ` Expected delivery: ${updated.expectedDeliveryDate}.` : '')
    );

    res.json({ success: true, order: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update Expected Delivery Date (Admin). Deliberately separate from the status route so
// that changing a date can never move an order to "Delivered" on its own.
app.patch('/api/orders/:id/delivery-date', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const cleaned = normalizeCalendarDate(req.body.expectedDeliveryDate);
    if (!cleaned) {
      return res.status(400).json({ error: 'Expected delivery date must be a real date in YYYY-MM-DD format.' });
    }
    const updated = await DB.updateOrderDeliveryDate(id, cleaned);
    if (!updated) return res.status(404).json({ error: 'Order not found' });

    await DB.appendOrderEvent(id, {
      status: updated.status,
      message: `Expected delivery date set to ${cleaned}`,
      timestamp: new Date().toISOString()
    });

    await notifyOrderCustomer(updated, `Delivery Date Updated for Order #${id}`, `Your order is now expected to arrive on ${cleaned}.`);

    res.json({ success: true, order: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Permanently Delete Order (Admin)
app.delete('/api/orders/:id', adminAuth, async (req, res) => {
  try {
    const success = await DB.deleteOrder(req.params.id);
    if (!success) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true, message: 'Order record deleted permanently.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Customer Orders Fetch
app.get('/api/customer/orders/:identifier', async (req, res) => {
  try {
    const query = req.params.identifier.trim().toLowerCase();
    const allOrders = await DB.getOrders();
    const userOrders = allOrders.filter(o => {
      const emailMatch = o.customerEmail && o.customerEmail.toLowerCase() === query;
      const phoneMatch = o.phone && o.phone.replace(/\D/g, '').includes(query.replace(/\D/g, ''));
      const userIdMatch = o.userId && o.userId.toLowerCase() === query;
      return emailMatch || phoneMatch || userIdMatch;
    });
    // Public tracking never exposes GPS coordinates
    const safeOrders = userOrders.map(o => {
      const { deliveryLocation, locationCapturedAt, ...rest } = o;
      return rest;
    });
    res.json(safeOrders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CUSTOMER AUTH & PROFILE ─────────────────────────
app.post('/api/customer/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, Email, and Password are required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = await DB.getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists. Please sign in!' });
    }

    const newUser = {
      userId: `AMC-USR-${Date.now().toString().slice(-6)}`,
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
      phone: (phone || '').trim(),
      authProvider: 'email',
      coinBalance: 50, // Welcome gift of 50 AM Coins!
      totalSpent: 0,
      totalOrders: 0,
      createdAt: new Date().toISOString()
    };

    const saved = await DB.addUser(newUser);

    // Initial welcome notification
    await DB.addNotification({
      id: `notif-${Date.now()}`,
      userId: saved.userId,
      title: '🎁 Welcome Bonus!',
      message: 'You received 50 AM Coins as a welcome gift! Use them on your first order.',
      type: 'coins',
      createdAt: new Date().toISOString()
    });

    const safe = { ...saved };
    delete safe.password;

    res.status(201).json({
      success: true,
      message: `Welcome to sabrXwatches, ${safe.name}! You earned 50 Welcome Coins! 🌟`,
      user: safe
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/customer/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await DB.getUserByEmail(cleanEmail);
    if (!user || user.password !== password.trim()) {
      return res.status(401).json({ error: 'Invalid email or password. Please try again or create an account.' });
    }
    if (user.status === 'Deleted') {
      return res.status(403).json({ error: 'This account has been closed. Please contact support to reopen it.' });
    }

    await DB.updateUser(user.userId, { lastLogin: new Date().toISOString() });

    const safe = { ...user };
    delete safe.password;

    res.json({
      success: true,
      message: `Welcome back, ${user.name}! 👑`,
      user: safe
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/customer/profile/:email', async (req, res) => {
  try {
    const user = await DB.getUserByEmail(req.params.email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const safe = { ...user };
    delete safe.password;
    res.json(safe);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/customer/profile', async (req, res) => {
  try {
    const { email, name, phone, address, landmark, city, state, pincode } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await DB.getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await DB.updateUser(user.userId, {
      ...(name && { name: name.trim() }),
      ...(phone !== undefined && { phone: phone.trim() }),
      ...(address !== undefined && { address: address.trim() }),
      ...(landmark !== undefined && { landmark: landmark.trim() }),
      ...(city !== undefined && { city: city.trim() }),
      ...(state !== undefined && { state: state.trim() }),
      ...(pincode !== undefined && { pincode: pincode.trim() })
    });

    res.json({ success: true, message: 'Profile updated successfully!', user: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin Customer List
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await DB.getUsers();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete / deactivate a customer. Order history is never destroyed: an account
// with past orders is soft-deleted so reports and tracking keep working.
app.delete('/api/admin/users/:userId', adminAuth, async (req, res) => {
  try {
    const user = await DB.getUserById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Customer account not found' });

    const history = await DB.countOrders({
      $or: [{ userId: user.userId }, { customerEmail: user.email }]
    });

    if (history > 0) {
      await DB.updateUser(user.userId, { status: 'Deleted', deletedAt: new Date() });
      return res.json({
        success: true,
        mode: 'deactivated',
        userId: user.userId,
        ordersPreserved: history,
        message: `Account deactivated. ${history} historical order(s) remain intact.`
      });
    }

    await DB.deleteUser(user.userId);
    res.json({
      success: true,
      mode: 'deleted',
      userId: user.userId,
      ordersPreserved: 0,
      message: 'Customer permanently removed — the account had no orders.'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── AM COINS & REWARDS ──────────────────────────────
app.get('/api/customer/coins/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await DB.getUserById(userId) || await DB.getUserByEmail(userId);
    const balance = user ? (user.coinBalance || 0) : 0;
    const history = user ? await DB.getCoinHistory(user.userId) : [];
    res.json({ balance, history });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── COUPONS ─────────────────────────────────────────
app.get('/api/coupons', async (req, res) => {
  try {
    const coupons = await DB.getCoupons();
    res.json(coupons);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/coupons', adminAuth, async (req, res) => {
  try {
    const { code, discountType, discountValue, minOrder, expiryDate, usageLimit } = req.body;
    if (!code || !discountValue) return res.status(400).json({ error: 'Coupon code and discount are required' });

    const exists = await DB.getCouponByCode(code);
    if (exists) return res.status(400).json({ error: 'Coupon with this code already exists' });

    const newCoupon = {
      code: code.trim().toUpperCase(),
      discountType: discountType || 'flat',
      discountValue: Number(discountValue),
      minOrder: Number(minOrder) || 0,
      expiryDate: expiryDate || '',
      usageLimit: Number(usageLimit) || 1000,
      usedCount: 0,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    const saved = await DB.addCoupon(newCoupon);
    res.status(201).json({ success: true, coupon: saved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, orderAmount } = req.body;
    if (!code) return res.status(400).json({ error: 'Please enter a coupon code' });

    const coupon = await DB.getCouponByCode(code);
    if (!coupon || !coupon.isActive) {
      return res.status(404).json({ error: 'Invalid or inactive coupon code' });
    }

    const subtotal = Number(orderAmount) || 0;
    if (coupon.minOrder && subtotal < coupon.minOrder) {
      return res.status(400).json({ error: `Minimum order amount of ₹${coupon.minOrder.toLocaleString('en-IN')} required for this coupon` });
    }

    let discount = 0;
    if (coupon.discountType === 'percent') {
      discount = Math.round((subtotal * coupon.discountValue) / 100);
    } else {
      discount = coupon.discountValue;
    }

    res.json({
      success: true,
      code: coupon.code,
      discount,
      message: `Coupon '${coupon.code}' applied! ₹${discount.toLocaleString('en-IN')} saved.`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/coupons/:code', adminAuth, async (req, res) => {
  try {
    const success = await DB.deleteCoupon(req.params.code);
    if (!success) return res.status(404).json({ error: 'Coupon not found' });
    res.json({ success: true, message: 'Coupon deleted permanently' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CATEGORIES ──────────────────────────────────────
app.get('/api/categories', async (req, res) => {
  try {
    const cats = await DB.getCategories();
    res.json(cats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/categories', adminAuth, async (req, res) => {
  try {
    const { name, icon, slug } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    const id = `cat-${(slug || name).toLowerCase().replace(/\s+/g, '-')}`;
    const newCat = {
      id,
      name: name.trim(),
      slug: (slug || name).toLowerCase().trim(),
      icon: icon || '⌚',
      sortOrder: Date.now()
    };
    const saved = await DB.addCategory(newCat);
    res.status(201).json({ success: true, category: saved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/categories/:id', adminAuth, async (req, res) => {
  try {
    const success = await DB.deleteCategory(req.params.id);
    if (!success) return res.status(404).json({ error: 'Category not found' });
    res.json({ success: true, message: 'Category deleted permanently' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ADMIN DASHBOARD STATS ───────────────────────────
// Business metrics are admin-only — the payload exposes revenue, order and customer counts.
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const products = await DB.getProducts({ includeHidden: 'true' });
    const orders = await DB.getOrders();
    const users = await DB.getUsers();

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalCustomers = users.length;
    const totalProducts = products.length;

    const coinsGiven = users.reduce((sum, u) => sum + (Number(u.coinBalance) || 0), 0);
    const lowStockWatches = products.filter(p => (p.stock || 0) <= 5);
    const bestSellers = products.filter(p => p.isBestSeller);

    res.json({
      totalOrders,
      totalRevenue,
      totalCustomers,
      totalProducts,
      coinsGiven,
      lowStockCount: lowStockWatches.length,
      bestSellersCount: bestSellers.length,
      database: 'MongoDB Atlas'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FALLBACK ROUTING ────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: `API endpoint ${req.path} not found` });
  }
  if (req.path === '/admin' || req.path === '/admin/' || req.path === '/admin.html') {
    res.sendFile(path.join(__dirname, 'admin.html'));
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// =====================================================
// SERVER BOOTSTRAP
// =====================================================
// JSON error responses for upload failures (size / type rejections)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err && (err.name === 'MulterError' || /only valid image|only jpg/i.test(err.message || ''))) {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

async function startServer() {
  try {
    await connectToDatabase();
    await seedInitialOnce();
  } catch (e) {
    console.error('Initial DB bootstrap notice:', e.message);
  }

  app.listen(PORT, () => {
    console.log('\n======================================================');
    console.log('🌟 sabrXwatches Luxury Watch Engine Online!');
    console.log(`🌐 Storefront:      http://localhost:${PORT}`);
    console.log(`👑 Admin Portal:    http://localhost:${PORT}/admin.html`);
    console.log(`📦 Database:        MongoDB Atlas (Permanent Cloud)`);
    console.log('======================================================\n');
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
