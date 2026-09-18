// AM COLLECTION - Enterprise Luxury Watch E-Commerce Server
// Supports MongoDB Atlas (via Mongoose) + NeDB Fallback + Full CRUD & Synchronization

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const Datastore = require('@seald-io/nedb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_PASSKEY = process.env.ADMIN_PASSKEY || 'admin123';
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || '';

// =====================================================
// DIRECTORIES
// =====================================================
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;
const UPLOADS_DIR = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
const DATA_DIR = isVercel ? path.join('/tmp', 'data') : path.join(__dirname, 'data');

[UPLOADS_DIR, DATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
  }
});

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
    const prefix = file.fieldname === 'logo' ? 'logo' : (file.fieldname === 'banner' ? 'banner' : 'watch');
    cb(null, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB media
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

// =====================================================
// INITIAL DEFAULTS (Used ONLY on very first initialization)
// =====================================================
const INITIAL_SETTINGS = {
  storeName: 'AM COLLECTION',
  tagline: 'Timeless Elegance - Master Copy Watches',
  logoUrl: '',
  faviconUrl: '',
  storePhone: '919876543210',
  announcementText: '✨ FREE Pan-India Cash on Delivery • 7-Day Hassle-Free Replacement • 100% Inspected',
  coinEarnRate: 1, // 1 coin per ₹100 spent
  coinRedeemRate: 1, // 1 coin = ₹1 discount
  adminPasskey: ADMIN_PASSKEY,
  isCatalogInitialized: true
};

const INITIAL_PRODUCTS = [
  { id:'amc-01', brand:'Rolex', model:'Submariner Date 41mm Ceramic', tagline:'1:1 Super Clone Master Edition', price:4499, originalPrice:1150000, rating:4.9, reviewsCount:148, badge:'BEST SELLER', category:'rolex', movement:'Japanese Automatic Movement', dialSize:'41 mm', glass:'Sapphire Crystal (Anti-Reflective)', strap:'Solid 904L Stainless Steel Oyster', image:'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop', description:'The archetype of the diver\'s watch. 1:1 weight, unidirectional rotating ceramic bezel, and sweeping second hand.', features:['Exact 1:1 weight & dimensions','Ceramic rotating Cerachrom bezel','Sweeping smooth automatic movement','Luminescent Chromalight hands & indices','Laser etched crown at 6 o\'clock'], isBestSeller:true, isNewArrival:false, isTrending:true, stock:25, isHidden:false },
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

// =====================================================
// DATABASE ADAPTER (MongoDB Mongoose OR NeDB)
// =====================================================
let useMongo = false;
let MongooseModels = {};

// NeDB datastores for offline / fallback
const nedbStores = {
  products:      new Datastore({ filename: path.join(DATA_DIR, 'products.db'), autoload: true }),
  branding:      new Datastore({ filename: path.join(DATA_DIR, 'settings.db'), autoload: true }),
  categories:    new Datastore({ filename: path.join(DATA_DIR, 'categories.db'), autoload: true }),
  heroBanners:   new Datastore({ filename: path.join(DATA_DIR, 'banners.db'), autoload: true }),
  orders:        new Datastore({ filename: path.join(DATA_DIR, 'orders.db'), autoload: true }),
  users:         new Datastore({ filename: path.join(DATA_DIR, 'users.db'), autoload: true }),
  coupons:       new Datastore({ filename: path.join(DATA_DIR, 'coupons.db'), autoload: true }),
  coins:         new Datastore({ filename: path.join(DATA_DIR, 'coins.db'), autoload: true }),
  reviews:       new Datastore({ filename: path.join(DATA_DIR, 'reviews.db'), autoload: true }),
  notifications: new Datastore({ filename: path.join(DATA_DIR, 'notifications.db'), autoload: true })
};

// Periodic NeDB compact
setInterval(() => {
  Object.values(nedbStores).forEach(store => {
    try { store.compactDatafile(); } catch (e) {}
  });
}, 30000);

// NeDB Async Helpers
const nedbHelper = {
  find: (store, q = {}) => new Promise((res, rej) => store.find(q, (err, docs) => err ? rej(err) : res(docs))),
  findOne: (store, q) => new Promise((res, rej) => store.findOne(q, (err, doc) => err ? rej(err) : res(doc))),
  insert: (store, doc) => new Promise((res, rej) => store.insert(doc, (err, newDoc) => err ? rej(err) : res(newDoc))),
  update: (store, q, update, opts = {}) => new Promise((res, rej) => store.update(q, { $set: update }, opts, (err, n) => err ? rej(err) : res(n))),
  remove: (store, q, opts = {}) => new Promise((res, rej) => store.remove(q, opts, (err, n) => err ? rej(err) : res(n))),
  count: (store, q = {}) => new Promise((res, rej) => store.count(q, (err, n) => err ? rej(err) : res(n)))
};

// Initialize Mongoose if URI exists
async function initMongo() {
  if (!MONGODB_URI) {
    console.log('ℹ️ No MONGODB_URI provided. Running NeDB embedded storage.');
    return;
  }
  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000
    });
    useMongo = true;
    console.log('✅ MongoDB Atlas connected successfully!');

    // Define Mongoose Schemas
    const productSchema = new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      brand: String,
      model: String,
      tagline: String,
      price: Number,
      originalPrice: Number,
      rating: { type: Number, default: 4.9 },
      reviewsCount: { type: Number, default: 50 },
      badge: { type: String, default: '1:1 MASTER' },
      category: String,
      movement: String,
      dialSize: String,
      glass: String,
      strap: String,
      image: String,
      videoUrl: String,
      description: String,
      features: [String],
      isBestSeller: { type: Boolean, default: false },
      isNewArrival: { type: Boolean, default: false },
      isTrending: { type: Boolean, default: false },
      isHidden: { type: Boolean, default: false },
      stock: { type: Number, default: 20 },
      discount: { type: Number, default: 0 },
      createdAt: { type: Date, default: Date.now }
    });

    const brandingSchema = new mongoose.Schema({
      storeName: { type: String, default: 'AM COLLECTION' },
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
      items: Array,
      subtotal: Number,
      discount: Number,
      couponDiscount: { type: Number, default: 0 },
      couponCode: { type: String, default: '' },
      coinsUsed: { type: Number, default: 0 },
      coinDiscount: { type: Number, default: 0 },
      coinsEarned: { type: Number, default: 0 },
      total: Number,
      paymentMethod: { type: String, default: 'Cash on Delivery (COD)' },
      status: { type: String, default: 'Confirmed' },
      trackingTimeline: [
        {
          status: String,
          timestamp: { type: Date, default: Date.now },
          message: String
        }
      ],
      createdAt: { type: Date, default: Date.now }
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
      status: { type: String, default: 'Active' },
      createdAt: { type: Date, default: Date.now },
      lastLogin: { type: Date, default: Date.now }
    });

    const couponSchema = new mongoose.Schema({
      code: { type: String, required: true, unique: true },
      discountType: { type: String, default: 'flat' }, // 'flat' or 'percent'
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

    MongooseModels = {
      Product: mongoose.models.Product || mongoose.model('Product', productSchema),
      Branding: mongoose.models.Branding || mongoose.model('Branding', brandingSchema),
      Category: mongoose.models.Category || mongoose.model('Category', categorySchema),
      HeroBanner: mongoose.models.HeroBanner || mongoose.model('HeroBanner', heroBannerSchema),
      Order: mongoose.models.Order || mongoose.model('Order', orderSchema),
      User: mongoose.models.User || mongoose.model('User', userSchema),
      Coupon: mongoose.models.Coupon || mongoose.model('Coupon', couponSchema),
      Coin: mongoose.models.Coin || mongoose.model('Coin', coinSchema),
      Review: mongoose.models.Review || mongoose.model('Review', reviewSchema),
      Notification: mongoose.models.Notification || mongoose.model('Notification', notificationSchema)
    };
  } catch (err) {
    console.error('⚠️ MongoDB Atlas Connection Error:', err.message);
    console.log('Falling back to local NeDB datastores.');
    useMongo = false;
  }
}

// Unified Database CRUD API Layer
const DB = {
  // Products
  async getProducts(query = {}) {
    if (useMongo) {
      return await MongooseModels.Product.find(query).lean();
    }
    return await nedbHelper.find(nedbStores.products, query);
  },
  async getProductById(id) {
    if (useMongo) {
      return await MongooseModels.Product.findOne({ id }).lean();
    }
    return await nedbHelper.findOne(nedbStores.products, { id });
  },
  async addProduct(doc) {
    if (useMongo) {
      return await MongooseModels.Product.create(doc);
    }
    return await nedbHelper.insert(nedbStores.products, doc);
  },
  async updateProduct(id, updates) {
    delete updates._id;
    if (useMongo) {
      return await MongooseModels.Product.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
    }
    await nedbHelper.update(nedbStores.products, { id }, updates);
    return await nedbHelper.findOne(nedbStores.products, { id });
  },
  async deleteProduct(id) {
    if (useMongo) {
      const res = await MongooseModels.Product.deleteOne({ id });
      return res.deletedCount > 0;
    }
    const n = await nedbHelper.remove(nedbStores.products, { id });
    return n > 0;
  },
  async countProducts(q = {}) {
    if (useMongo) return await MongooseModels.Product.countDocuments(q);
    return await nedbHelper.count(nedbStores.products, q);
  },

  // Branding / Settings
  async getBranding() {
    if (useMongo) {
      let b = await MongooseModels.Branding.findOne().lean();
      if (!b) {
        b = await MongooseModels.Branding.create(INITIAL_SETTINGS);
      }
      return b;
    }
    let b = await nedbHelper.findOne(nedbStores.branding, {});
    if (!b) {
      b = await nedbHelper.insert(nedbStores.branding, INITIAL_SETTINGS);
    }
    return b;
  },
  async updateBranding(updates) {
    delete updates._id;
    if (useMongo) {
      let b = await MongooseModels.Branding.findOne();
      if (!b) {
        return await MongooseModels.Branding.create({ ...INITIAL_SETTINGS, ...updates });
      }
      Object.assign(b, updates);
      await b.save();
      return b.toObject();
    }
    const existing = await nedbHelper.findOne(nedbStores.branding, {});
    if (!existing) {
      return await nedbHelper.insert(nedbStores.branding, { ...INITIAL_SETTINGS, ...updates });
    }
    await nedbHelper.update(nedbStores.branding, { _id: existing._id }, updates);
    return await nedbHelper.findOne(nedbStores.branding, {});
  },

  // Orders
  async getOrders(q = {}) {
    if (useMongo) {
      return await MongooseModels.Order.find(q).sort({ createdAt: -1 }).lean();
    }
    const orders = await nedbHelper.find(nedbStores.orders, q);
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return orders;
  },
  async getOrderById(orderId) {
    if (useMongo) return await MongooseModels.Order.findOne({ orderId }).lean();
    return await nedbHelper.findOne(nedbStores.orders, { orderId });
  },
  async addOrder(doc) {
    if (useMongo) return await MongooseModels.Order.create(doc);
    return await nedbHelper.insert(nedbStores.orders, doc);
  },
  async updateOrderStatus(orderId, status, message) {
    const trackingEntry = {
      status,
      timestamp: new Date(),
      message: message || `Order status updated to ${status}`
    };
    if (useMongo) {
      return await MongooseModels.Order.findOneAndUpdate(
        { orderId },
        {
          $set: { status },
          $push: { trackingTimeline: trackingEntry }
        },
        { new: true }
      ).lean();
    }
    const order = await nedbHelper.findOne(nedbStores.orders, { orderId });
    if (!order) return null;
    const timeline = order.trackingTimeline || [];
    timeline.push(trackingEntry);
    await nedbHelper.update(nedbStores.orders, { orderId }, { status, trackingTimeline: timeline });
    return await nedbHelper.findOne(nedbStores.orders, { orderId });
  },
  async deleteOrder(orderId) {
    if (useMongo) {
      const res = await MongooseModels.Order.deleteOne({ orderId });
      return res.deletedCount > 0;
    }
    const n = await nedbHelper.remove(nedbStores.orders, { orderId });
    return n > 0;
  },
  async countOrders(q = {}) {
    if (useMongo) return await MongooseModels.Order.countDocuments(q);
    return await nedbHelper.count(nedbStores.orders, q);
  },

  // Users
  async getUsers(q = {}) {
    if (useMongo) return await MongooseModels.User.find(q).select('-password').sort({ createdAt: -1 }).lean();
    const users = await nedbHelper.find(nedbStores.users, q);
    return users.map(u => {
      const safe = { ...u };
      delete safe.password;
      return safe;
    });
  },
  async getUserById(userId) {
    if (useMongo) return await MongooseModels.User.findOne({ userId }).lean();
    return await nedbHelper.findOne(nedbStores.users, { userId });
  },
  async getUserByEmail(email) {
    const clean = email.trim().toLowerCase();
    if (useMongo) return await MongooseModels.User.findOne({ email: clean }).lean();
    return await nedbHelper.findOne(nedbStores.users, { email: clean });
  },
  async addUser(doc) {
    if (useMongo) return await MongooseModels.User.create(doc);
    return await nedbHelper.insert(nedbStores.users, doc);
  },
  async updateUser(userId, updates) {
    delete updates._id;
    delete updates.password; // Do not overwrite password directly here
    if (useMongo) {
      return await MongooseModels.User.findOneAndUpdate({ userId }, { $set: updates }, { new: true }).select('-password').lean();
    }
    await nedbHelper.update(nedbStores.users, { userId }, updates);
    const u = await nedbHelper.findOne(nedbStores.users, { userId });
    if (u) delete u.password;
    return u;
  },
  async countUsers(q = {}) {
    if (useMongo) return await MongooseModels.User.countDocuments(q);
    return await nedbHelper.count(nedbStores.users, q);
  },

  // Categories
  async getCategories() {
    if (useMongo) return await MongooseModels.Category.find().sort({ sortOrder: 1 }).lean();
    const cats = await nedbHelper.find(nedbStores.categories, {});
    cats.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    return cats;
  },
  async addCategory(doc) {
    if (useMongo) return await MongooseModels.Category.create(doc);
    return await nedbHelper.insert(nedbStores.categories, doc);
  },
  async deleteCategory(id) {
    if (useMongo) {
      const res = await MongooseModels.Category.deleteOne({ id });
      return res.deletedCount > 0;
    }
    const n = await nedbHelper.remove(nedbStores.categories, { id });
    return n > 0;
  },

  // Coupons
  async getCoupons() {
    if (useMongo) return await MongooseModels.Coupon.find().lean();
    return await nedbHelper.find(nedbStores.coupons, {});
  },
  async getCouponByCode(code) {
    const clean = code.trim().toUpperCase();
    if (useMongo) return await MongooseModels.Coupon.findOne({ code: clean }).lean();
    return await nedbHelper.findOne(nedbStores.coupons, { code: clean });
  },
  async addCoupon(doc) {
    doc.code = doc.code.trim().toUpperCase();
    if (useMongo) return await MongooseModels.Coupon.create(doc);
    return await nedbHelper.insert(nedbStores.coupons, doc);
  },
  async deleteCoupon(code) {
    const clean = code.trim().toUpperCase();
    if (useMongo) {
      const res = await MongooseModels.Coupon.deleteOne({ code: clean });
      return res.deletedCount > 0;
    }
    const n = await nedbHelper.remove(nedbStores.coupons, { code: clean });
    return n > 0;
  },

  // Coins
  async logCoinTransaction(doc) {
    if (useMongo) return await MongooseModels.Coin.create(doc);
    return await nedbHelper.insert(nedbStores.coins, doc);
  },
  async getCoinHistory(userId) {
    if (useMongo) return await MongooseModels.Coin.find({ userId }).sort({ createdAt: -1 }).lean();
    const list = await nedbHelper.find(nedbStores.coins, { userId });
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  },

  // Notifications
  async addNotification(doc) {
    if (useMongo) return await MongooseModels.Notification.create(doc);
    return await nedbHelper.insert(nedbStores.notifications, doc);
  },
  async getNotifications(userId) {
    if (useMongo) return await MongooseModels.Notification.find({ userId }).sort({ createdAt: -1 }).lean();
    const list = await nedbHelper.find(nedbStores.notifications, { userId });
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  }
};

// =====================================================
// SEED DATABASE (Run only if never initialized before)
// =====================================================
async function seedInitialOnce() {
  try {
    const branding = await DB.getBranding();
    if (branding && branding.isCatalogInitialized) {
      // Catalog has already been initialized before.
      // NEVER auto-seed or restore deleted products!
      return;
    }

    const count = await DB.countProducts();
    if (count === 0) {
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
// REST API ROUTES
// =====================================================

// Health / Status
app.get('/api/health', async (req, res) => {
  try {
    const productsCount = await DB.countProducts();
    const ordersCount = await DB.countOrders();
    const usersCount = await DB.countUsers();
    res.json({
      status: 'ok',
      database: useMongo ? 'MongoDB Atlas (Connected)' : 'NeDB (Embedded)',
      products: productsCount,
      orders: ordersCount,
      customers: usersCount,
      uptime: Math.round(process.uptime()) + 's'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin Passkey Helper
async function getAdminPasskey() {
  const b = await DB.getBranding();
  return (b && b.adminPasskey) ? b.adminPasskey : ADMIN_PASSKEY;
}

// Admin Auth Verify
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { passkey } = req.body;
    const currentKey = await getAdminPasskey();
    if (passkey === currentKey || passkey === ADMIN_PASSKEY) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Invalid admin passkey' });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin Change Passkey
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
    await DB.updateBranding({ adminPasskey: newPasskey.trim() });
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

app.post('/api/settings', async (req, res) => {
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
app.post('/api/settings/logo', upload.single('logo'), async (req, res) => {
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
app.delete('/api/settings/logo', async (req, res) => {
  try {
    await DB.updateBranding({ logoUrl: '' });
    res.json({ success: true, message: 'Logo removed permanently. Default monogram will display.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PRODUCTS ────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, sort, includeHidden } = req.query;
    let products = await DB.getProducts();

    // Storefront does not see hidden products unless explicitly requested by admin
    if (includeHidden !== 'true') {
      products = products.filter(p => !p.isHidden);
    }

    if (category && category !== 'all') {
      products = products.filter(p => p.category === category.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase().trim();
      products = products.filter(p =>
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.model && p.model.toLowerCase().includes(q)) ||
        (p.tagline && p.tagline.toLowerCase().includes(q)) ||
        (p.movement && p.movement.toLowerCase().includes(q))
      );
    }

    if (sort === 'price-low')  products.sort((a, b) => a.price - b.price);
    if (sort === 'price-high') products.sort((a, b) => b.price - a.price);
    if (sort === 'rating')     products.sort((a, b) => b.rating - a.rating);
    if (sort === 'newest')     products.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

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

app.post('/api/products', uploadMedia, async (req, res) => {
  try {
    const b = req.body;
    const files = req.files || {};

    let image = b.imageUrl || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop';
    if (files.image && files.image[0]) image = `/uploads/${files.image[0].filename}`;

    let videoUrl = b.videoUrl || '';
    if (files.video && files.video[0]) videoUrl = `/uploads/${files.video[0].filename}`;

    const product = {
      id: `amc-${Date.now().toString().slice(-8)}`,
      brand: b.brand || 'Rolex',
      model: b.model || 'Master Edition',
      tagline: b.tagline || '1:1 Super Clone Master Edition',
      price: Number(b.price) || 3999,
      originalPrice: Number(b.originalPrice) || 850000,
      rating: Number(b.rating) || 4.9,
      reviewsCount: Number(b.reviewsCount) || 50,
      badge: (b.badge || '1:1 MASTER').toUpperCase(),
      category: (b.category || 'other').toLowerCase(),
      movement: b.movement || 'Japanese Automatic Movement',
      dialSize: b.dialSize || '41 mm',
      glass: b.glass || 'Sapphire Crystal (Anti-Reflective)',
      strap: b.strap || 'Solid 904L Stainless Steel',
      description: b.description || '1:1 luxury master copy timepiece.',
      features: Array.isArray(b.features)
        ? b.features
        : (b.features ? b.features.split('\n').map(f => f.trim()).filter(Boolean) : ['1:1 exact dimensions & weight']),
      image,
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

app.put('/api/products/:id', uploadMedia, async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body;
    const files = req.files || {};
    const updates = { ...b };

    if (updates.price) updates.price = Number(updates.price);
    if (updates.originalPrice) updates.originalPrice = Number(updates.originalPrice);
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

    if (files.video && files.video[0]) updates.videoUrl = `/uploads/${files.video[0].filename}`;
    else if (b.videoUrl !== undefined) updates.videoUrl = b.videoUrl;

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
app.delete('/api/products/:id', async (req, res) => {
  try {
    const success = await DB.deleteProduct(req.params.id);
    if (!success) return res.status(404).json({ error: 'Watch not found or already deleted' });
    res.json({ success: true, message: 'Watch permanently deleted from database.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Toggle Product Flag (Hidden, Best Seller, New Arrival, Trending)
app.patch('/api/products/:id/toggle', async (req, res) => {
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

// Manual Seed Initial Defaults (Admin action only)
app.post('/api/admin/seed-defaults', async (req, res) => {
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
app.get('/api/orders', async (req, res) => {
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
    const totalAmount = Number(b.total) || 0;
    const branding = await DB.getBranding();
    const earnRate = branding.coinEarnRate || 1; // 1 coin per 100 spent

    // Calculate AM Coins earned: 1 coin per ₹100 spent
    const coinsEarned = Math.floor(totalAmount / 100) * earnRate;
    const coinsUsed = Number(b.coinsUsed) || 0;
    const coinDiscount = Number(b.coinDiscount) || 0;

    const newOrder = {
      orderId,
      userId: b.userId || (b.customer && b.customer.userId) || '',
      customerName: b.customerName || (b.customer && b.customer.fullName) || 'Valued Patron',
      customerEmail: (b.customerEmail || (b.customer && b.customer.customerEmail) || '').toLowerCase().trim(),
      phone: b.phone || (b.customer && b.customer.phone) || '',
      altPhone: b.altPhone || (b.customer && b.customer.altPhone) || '',
      address: b.address || (b.customer && b.customer.address) || '',
      landmark: b.landmark || (b.customer && b.customer.landmark) || '',
      city: b.city || (b.customer && b.customer.city) || '',
      state: b.state || (b.customer && b.customer.state) || '',
      pincode: b.pincode || (b.customer && b.customer.pincode) || '',
      items: b.items || [],
      subtotal: Number(b.subtotal) || totalAmount,
      discount: Number(b.discount) || 0,
      couponDiscount: Number(b.couponDiscount) || 0,
      couponCode: b.couponCode || '',
      coinsUsed,
      coinDiscount,
      coinsEarned,
      total: totalAmount,
      paymentMethod: b.paymentMethod || 'Cash on Delivery (COD)',
      status: 'Confirmed',
      trackingTimeline: [
        {
          status: 'Confirmed',
          timestamp: new Date().toISOString(),
          message: 'Order verified & confirmed for Cash on Delivery dispatch.'
        }
      ],
      createdAt: new Date().toISOString()
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
          title: '🎉 Order Confirmed!',
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
      message: 'Order placed successfully! Cash on Delivery confirmed.'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update Order Status (Admin)
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, message } = req.body;
    const updated = await DB.updateOrderStatus(id, status, message);
    if (!updated) return res.status(404).json({ error: 'Order not found' });

    // Send notification to customer
    if (updated.userId || updated.customerEmail) {
      const user = updated.userId ? await DB.getUserById(updated.userId) : await DB.getUserByEmail(updated.customerEmail);
      if (user) {
        await DB.addNotification({
          id: `notif-${Date.now()}`,
          userId: user.userId,
          title: `Order #${id} Updated`,
          message: `Your order status is now: ${status}`,
          type: 'order',
          createdAt: new Date().toISOString()
        });
      }
    }

    res.json({ success: true, order: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Permanently Delete Order (Admin)
app.delete('/api/orders/:id', async (req, res) => {
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
    res.json(userOrders);
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
      message: `Welcome to AM COLLECTION, ${safe.name}! You earned 50 Welcome Coins! 🌟`,
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

// Admin Users List
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await DB.getUsers();
    res.json(users);
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

app.post('/api/coupons', async (req, res) => {
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

app.delete('/api/coupons/:code', async (req, res) => {
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

app.post('/api/categories', async (req, res) => {
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

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const success = await DB.deleteCategory(req.params.id);
    if (!success) return res.status(404).json({ error: 'Category not found' });
    res.json({ success: true, message: 'Category deleted permanently' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ADMIN DASHBOARD STATS ───────────────────────────
app.get('/api/admin/stats', async (req, res) => {
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
      database: useMongo ? 'MongoDB Atlas' : 'NeDB Engine'
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
async function startServer() {
  await initMongo();
  await seedInitialOnce();

  app.listen(PORT, () => {
    console.log('\n======================================================');
    console.log('🌟 AM COLLECTION Luxury Watch Engine Online!');
    console.log(`🌐 Storefront:      http://localhost:${PORT}`);
    console.log(`👑 Admin Portal:    http://localhost:${PORT}/admin.html`);
    console.log(`📦 Database:        ${useMongo ? 'MongoDB Atlas (Connected)' : 'NeDB Embedded'}`);
    console.log('======================================================\n');
  });
}

if (require.main === module) {
  startServer();
} else {
  // On Vercel serverless functions
  initMongo().then(() => seedInitialOnce()).catch(console.error);
}

module.exports = app;
