// AM COLLECTION - Main Application Controller

let liveProducts = (typeof PRODUCTS_DATA !== 'undefined') ? [...PRODUCTS_DATA] : [];
let activeCategory = 'all';
let searchQuery = '';
let currentSort = 'featured';
let activeQuickViewProduct = null;

// Customer Privilege Authentication State
let currentCustomer = null;
try {
  currentCustomer = JSON.parse(localStorage.getItem('amc_customer') || 'null');
} catch (e) {
  currentCustomer = null;
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Cart UI
  cartManager.renderCartUI();

  // Initialize Customer Auth UI
  updateCustomerHeaderUI();

  // Render Initial Products
  renderProducts();

  // Event Listeners
  setupEventListeners();

  // Setup Mobile Nav
  setupMobileMenu();

  // Sync with Backend (Settings & Products)
  syncWithBackend();
});

// Synchronize with Express / MongoDB API
async function syncWithBackend() {
  try {
    const [settingsRes, productsRes] = await Promise.allSettled([
      fetch('/api/settings'),
      fetch('/api/products')
    ]);

    if (settingsRes.status === 'fulfilled' && settingsRes.value.ok) {
      const settings = await settingsRes.value.json();
      applyBrandingSettings(settings);
    }

    if (productsRes.status === 'fulfilled' && productsRes.value.ok) {
      const prods = await productsRes.value.json();
      if (Array.isArray(prods) && prods.length > 0) {
        liveProducts = prods;
        renderProducts();
      }
    }
  } catch (e) {
    // Running in static/offline mode, using built-in PRODUCTS_DATA
  }
}

function applyBrandingSettings(settings) {
  if (settings.storeName) {
    const el = document.getElementById('header-store-name');
    if (el) el.textContent = settings.storeName;
    document.title = `${settings.storeName} | ${settings.tagline || 'Master Copy Watches'}`;
  }
  if (settings.tagline) {
    const el = document.getElementById('header-store-tagline');
    if (el) el.textContent = settings.tagline;
  }
  if (settings.announcementText) {
    const el = document.getElementById('top-announcement-text');
    if (el) el.innerHTML = settings.announcementText;
  }
  if (settings.storePhone) {
    checkoutManager.setStorePhone(settings.storePhone);
  }
  if (settings.logoUrl) {
    const img = document.getElementById('header-logo-img');
    const monogram = document.getElementById('header-logo-monogram');
    if (img && monogram) {
      img.src = settings.logoUrl;
      img.classList.remove('hidden');
      monogram.classList.add('hidden');
    }
  }
}

// Setup All DOM Event Listeners
function setupEventListeners() {
  // Search Input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderProducts();
    });
  }

  // Sort Dropdown
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderProducts();
    });
  }

  // Category Filter Buttons
  document.querySelectorAll('.category-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.category-filter-btn').forEach(b => {
        b.classList.remove('bg-amber-500', 'text-black', 'border-amber-400');
        b.classList.add('bg-neutral-900', 'text-neutral-300', 'border-neutral-800');
      });

      const target = e.currentTarget;
      target.classList.remove('bg-neutral-900', 'text-neutral-300', 'border-neutral-800');
      target.classList.add('bg-amber-500', 'text-black', 'border-amber-400');

      activeCategory = target.getAttribute('data-category');
      renderProducts();
    });
  });

  // Cart Drawer Toggles
  const cartTriggerBtns = document.querySelectorAll('.cart-drawer-trigger');
  cartTriggerBtns.forEach(btn => {
    btn.addEventListener('click', openCartDrawer);
  });

  const cartCloseBtn = document.getElementById('cart-close-btn');
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCartDrawer);

  const cartBackdrop = document.getElementById('cart-backdrop');
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCartDrawer);

  // COD Checkout Modal Trigger
  const codTriggerBtn = document.getElementById('cart-checkout-cod-btn');
  if (codTriggerBtn) {
    codTriggerBtn.addEventListener('click', () => {
      closeCartDrawer();
      openCheckoutModal('cod');
    });
  }

  // WhatsApp Checkout Modal / Direct Action from Cart
  const cartWaBtn = document.getElementById('cart-checkout-wa-btn');
  if (cartWaBtn) {
    cartWaBtn.addEventListener('click', () => {
      const items = cartManager.getItems();
      if (items.length === 0) {
        showToast('Your cart is empty. Add a watch to order!', 'info');
        return;
      }
      closeCartDrawer();
      openCheckoutModal('whatsapp');
    });
  }

  // Checkout Modal Close
  const checkoutCloseBtn = document.getElementById('checkout-modal-close');
  if (checkoutCloseBtn) checkoutCloseBtn.addEventListener('click', closeCheckoutModal);

  // Success Modal Close
  const successCloseBtn = document.getElementById('order-success-close');
  if (successCloseBtn) {
    successCloseBtn.addEventListener('click', () => {
      document.getElementById('order-success-modal').classList.add('hidden');
    });
  }

  // Quick View Close
  const quickViewClose = document.getElementById('quick-view-close');
  if (quickViewClose) {
    quickViewClose.addEventListener('click', closeQuickViewModal);
  }

  // COD Checkout Form Submission
  const codForm = document.getElementById('cod-checkout-form');
  if (codForm) {
    codForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleCodFormSubmit();
    });
  }

  // WhatsApp Order Form Submission
  const waForm = document.getElementById('whatsapp-order-form');
  if (waForm) {
    waForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleWhatsAppFormSubmit();
    });
  }

  // Coupon Form
  const couponForm = document.getElementById('cart-coupon-form');
  if (couponForm) {
    couponForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const codeInput = document.getElementById('coupon-input');
      const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
      if (code === 'WELCOME500' || code === 'LUXURY10') {
        cartManager.saveCoupon(code);
        showToast(`Promo code "${code}" applied successfully! 🎁`, 'success');
        if (codeInput) codeInput.value = '';
      } else {
        showToast('Invalid coupon code. Try WELCOME500 or LUXURY10', 'error');
      }
    });
  }

  // Store WhatsApp Setting Dialog
  const phoneSettingBtn = document.getElementById('settings-wa-btn');
  if (phoneSettingBtn) {
    phoneSettingBtn.addEventListener('click', handleStorePhoneChange);
  }

  // Floating WhatsApp Support
  const floatingWa = document.getElementById('floating-whatsapp');
  if (floatingWa) {
    floatingWa.addEventListener('click', () => {
      const phone = checkoutManager.getStorePhone();
      const text = encodeURIComponent("Hello AM COLLECTION! I have an inquiry regarding your luxury master copy watches.");
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    });
  }

  // Keyboard Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCartDrawer();
      closeCheckoutModal();
      closeQuickViewModal();
      closeAuthModal();
      closeProfileModal();
      closeMyOrdersModal();
      const successModal = document.getElementById('order-success-modal');
      if (successModal) successModal.classList.add('hidden');
    }
  });

  // Click outside to close user dropdown
  document.addEventListener('click', (e) => {
    const container = document.getElementById('user-account-container');
    const dropdown = document.getElementById('user-dropdown-menu');
    if (container && dropdown && !container.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

// Render Products Grid
function renderProducts() {
  const container = document.getElementById('products-grid');
  const countEl = document.getElementById('products-count-badge');
  if (!container) return;

  // Filter
  let filtered = liveProducts.filter(product => {
    const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
    const matchesSearch = !searchQuery || 
      product.brand.toLowerCase().includes(searchQuery) ||
      product.model.toLowerCase().includes(searchQuery) ||
      product.movement.toLowerCase().includes(searchQuery) ||
      product.description.toLowerCase().includes(searchQuery);

    return matchesCategory && matchesSearch;
  });

  // Sort
  if (currentSort === 'price-low') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (currentSort === 'price-high') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (currentSort === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  } else if (currentSort === 'name') {
    filtered.sort((a, b) => a.model.localeCompare(b.model));
  }

  if (countEl) {
    countEl.textContent = `${filtered.length} Masterpieces Available`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center">
        <div class="w-16 h-16 mx-auto mb-4 text-neutral-600">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <h3 class="text-xl font-bold text-neutral-300 font-luxury mb-2">No Matching Watches Found</h3>
        <p class="text-neutral-500 text-sm mb-6 max-w-md mx-auto">Try searching for other luxury brands like Rolex, Casio Vintage, Patek Philippe, or Audemars Piguet.</p>
        <button onclick="resetFilters()" class="gold-btn px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider">
          View All Watches
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(product => {
    const savingsPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);

    return `
      <div class="product-card group relative flex flex-col bg-neutral-900/60 rounded-2xl border border-neutral-800/80 hover:border-amber-500/40 transition-all duration-300 luxury-card overflow-hidden">
        
        <!-- Image & Quick View trigger -->
        <div onclick="openQuickView('${product.id}')" class="product-image-container relative aspect-square w-full cursor-pointer overflow-hidden">
          <img 
            src="${product.image}" 
            alt="${product.brand} ${product.model}" 
            loading="lazy" 
            class="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            onerror="this.src='https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop'"
          />
          
          <!-- Top Badges -->
          <div class="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            <span class="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase bg-amber-500 text-black rounded-md shadow-lg">
              ${product.badge}
            </span>
            <span class="px-2 py-0.5 text-[9px] font-semibold tracking-wider uppercase bg-black/80 text-amber-300 border border-amber-500/30 rounded backdrop-blur-md">
              1:1 Master Clone
            </span>
          </div>

          <!-- Hover Overlay / Tap to Open Badge -->
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
            <span class="px-3.5 py-2 rounded-xl bg-black/85 text-amber-400 border border-amber-400/50 text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-2xl flex items-center gap-1.5">
              <span>👁️</span> Open &amp; Inspect
            </span>
          </div>

          <!-- Quick View Top-Right Float Button -->
          <button 
            type="button"
            onclick="event.stopPropagation(); openQuickView('${product.id}')"
            class="absolute top-3 right-3 w-9 h-9 rounded-full bg-neutral-900/85 backdrop-blur-md border border-neutral-700 text-neutral-300 hover:text-amber-400 hover:border-amber-400 flex items-center justify-center transition-all shadow-xl z-20"
            title="Open Watch Details"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
          </button>

          <!-- Savings Badge -->
          <div class="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold z-10">
            ${savingsPercent}% OFF
          </div>
        </div>

        <!-- Details Section -->
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <!-- Brand & Movement -->
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="text-[11px] font-bold tracking-widest uppercase text-amber-400 cursor-pointer" onclick="openQuickView('${product.id}')">${product.brand}</span>
              <div class="flex items-center gap-1 text-[11px] text-neutral-400 font-medium">
                <span class="text-amber-400">★</span>
                <span>${product.rating}</span>
                <span class="text-neutral-600">(${product.reviewsCount})</span>
              </div>
            </div>

            <!-- Model Name (Clickable) -->
            <h3 
              onclick="openQuickView('${product.id}')"
              class="text-base font-bold text-neutral-100 hover:text-amber-300 transition-colors line-clamp-1 mb-1 cursor-pointer" 
              title="${product.model} (Click to inspect)"
            >
              ${product.model}
            </h3>

            <!-- Movement Pill -->
            <div class="inline-flex items-center gap-1.5 px-2 py-0.5 mb-3 bg-neutral-950 rounded-md border border-neutral-800 text-[11px] text-neutral-300">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="truncate">${product.movement}</span>
            </div>

            <!-- Price Block -->
            <div class="flex items-baseline gap-2 mb-3">
              <span class="text-xl font-extrabold text-white">₹${product.price.toLocaleString('en-IN')}</span>
              <span class="text-xs text-neutral-500 line-through">₹${product.originalPrice.toLocaleString('en-IN')}</span>
              <span class="text-[10px] text-amber-500/90 font-medium">Free COD</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-2 pt-2 border-t border-neutral-800/80">
            <!-- Open & View Watch Button -->
            <button 
              type="button"
              onclick="openQuickView('${product.id}')"
              class="w-full py-2 px-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 hover:text-amber-300 border border-neutral-700/80 hover:border-amber-400/40 flex items-center justify-center gap-1.5 text-xs font-semibold tracking-wider transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              <span>Inspect &amp; View Details</span>
            </button>

            <!-- Add to Cart -->
            <button 
              onclick="addToCart('${product.id}')"
              class="w-full py-2.5 px-4 rounded-xl gold-btn flex items-center justify-center gap-2 text-xs font-bold tracking-wider uppercase transition-all shadow-md active:scale-95"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
              <span>Add to Cart</span>
            </button>

            <!-- Direct WhatsApp Order -->
            <button 
              onclick="directWhatsAppBuy('${product.id}')"
              class="w-full py-2 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-500/40 hover:border-emerald-400 flex items-center justify-center gap-2 text-xs font-semibold tracking-wider transition-all"
            >
              <svg class="w-4 h-4 fill-current text-emerald-400" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.288.043.088.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.203c.043.072.043.419-.101.824z"/></svg>
              <span>Order via WhatsApp</span>
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// Reset All Filters
function resetFilters() {
  activeCategory = 'all';
  searchQuery = '';
  currentSort = 'featured';

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = 'featured';

  document.querySelectorAll('.category-filter-btn').forEach(b => {
    if (b.getAttribute('data-category') === 'all') {
      b.classList.remove('bg-neutral-900', 'text-neutral-300', 'border-neutral-800');
      b.classList.add('bg-amber-500', 'text-black', 'border-amber-400');
    } else {
      b.classList.remove('bg-amber-500', 'text-black', 'border-amber-400');
      b.classList.add('bg-neutral-900', 'text-neutral-300', 'border-neutral-800');
    }
  });

  renderProducts();
}

// Add To Cart Action
function addToCart(productId, qty = 1) {
  const product = liveProducts.find(p => p.id === productId);
  if (!product) return;

  cartManager.addItem(product, qty);
  showToast(`Added ${product.brand} ${product.model} to cart!`, 'success');
}

// Direct Buy via WhatsApp
function directWhatsAppBuy(productId) {
  const product = liveProducts.find(p => p.id === productId);
  if (!product) return;
  checkoutManager.quickBuyWhatsApp(product);
}

// Quick View / Watch Detail Modal Controller
function openQuickView(productId) {
  const product = liveProducts.find(p => p.id === productId);
  if (!product) return;

  activeQuickViewProduct = product;
  const modal = document.getElementById('quick-view-modal');
  if (!modal) return;

  // Set Badges & Ratings
  const badgeEl = document.getElementById('qv-badge');
  if (badgeEl) badgeEl.textContent = product.badge || 'MASTER EDITION';

  const ratingVal = document.getElementById('qv-rating-val');
  if (ratingVal) ratingVal.textContent = product.rating || '4.9';

  const reviewsVal = document.getElementById('qv-reviews-val');
  if (reviewsVal) reviewsVal.textContent = `(${product.reviewsCount || 100}+ reviews)`;

  const savingsPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  const savingsAmount = product.originalPrice - product.price;
  const savingsBadge = document.getElementById('qv-savings-badge');
  if (savingsBadge) {
    savingsBadge.textContent = `Save ₹${savingsAmount.toLocaleString('en-IN')} (${savingsPercent}% OFF)`;
  }

  // Set Details
  const brandEl = document.getElementById('qv-brand');
  const modelEl = document.getElementById('qv-model');
  const taglineEl = document.getElementById('qv-tagline');
  const priceEl = document.getElementById('qv-price');
  const originalPriceEl = document.getElementById('qv-original-price');
  const descEl = document.getElementById('qv-description');
  const imgEl = document.getElementById('qv-image');

  if (brandEl) brandEl.textContent = product.brand;
  if (modelEl) modelEl.textContent = product.model;
  if (taglineEl) taglineEl.textContent = product.tagline;
  if (priceEl) priceEl.textContent = `₹${product.price.toLocaleString('en-IN')}`;
  if (originalPriceEl) originalPriceEl.textContent = `₹${product.originalPrice.toLocaleString('en-IN')}`;
  if (descEl) descEl.textContent = product.description;
  if (imgEl) imgEl.src = product.image;

  // Set Specs
  const specMovement = document.getElementById('qv-spec-movement');
  const specDial = document.getElementById('qv-spec-dial');
  const specGlass = document.getElementById('qv-spec-glass');
  const specStrap = document.getElementById('qv-spec-strap');
  const specWater = document.getElementById('qv-spec-water');
  const specClasp = document.getElementById('qv-spec-clasp');

  if (specMovement) specMovement.textContent = product.movement || '1:1 Automatic';
  if (specDial) specDial.textContent = product.dialSize || 'Standard Case';
  if (specGlass) specGlass.textContent = product.glass || 'Sapphire Crystal';
  if (specStrap) specStrap.textContent = product.strap || 'Solid 904L Steel';
  if (specWater) specWater.textContent = product.waterResistance || 'Daily Splash Proof';
  if (specClasp) specClasp.textContent = product.clasp || 'Deployment Clasp';

  // Set Features Checklist
  const featuresList = document.getElementById('qv-features-list');
  if (featuresList) {
    const feats = Array.isArray(product.features) && product.features.length > 0
      ? product.features
      : ['Exact 1:1 weight & dimensions', 'Sapphire crystal coating', 'Smooth automatic movement', 'Laser engravings'];

    featuresList.innerHTML = feats.map(f => `
      <li class="flex items-center gap-2 text-xs text-neutral-300">
        <span class="text-amber-400 font-bold">✔</span>
        <span>${f}</span>
      </li>
    `).join('');
  }

  // 1-Click Buy Now (COD) Inside Modal
  const buyNowBtn = document.getElementById('qv-buy-now-btn');
  if (buyNowBtn) {
    buyNowBtn.onclick = () => {
      cartManager.addItem(product, 1);
      closeQuickViewModal();
      openCheckoutModal('cod');
    };
  }

  // Add to Bag Button Inside Modal
  const addBtn = document.getElementById('qv-add-to-cart-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      addToCart(product.id, 1);
      closeQuickViewModal();
      openCartDrawer();
    };
  }

  // WhatsApp Button Inside Modal
  const waBtn = document.getElementById('qv-whatsapp-btn');
  if (waBtn) {
    waBtn.onclick = () => {
      directWhatsAppBuy(product.id);
    };
  }

  // ── Product Showcase Video ──────────────────────────
  const qvVideoSection = document.getElementById('qv-video-section');
  const qvVideoEl      = document.getElementById('qv-video-player');
  const qvVideoIframe  = document.getElementById('qv-video-iframe');

  if (qvVideoSection && qvVideoEl && qvVideoIframe) {
    const vid = product.videoUrl || '';
    if (vid && vid !== 'REMOVE') {
      qvVideoSection.classList.remove('hidden');
      const ytMatch = vid.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
      if (ytMatch) {
        qvVideoEl.classList.add('hidden');
        qvVideoIframe.classList.remove('hidden');
        qvVideoIframe.src = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0`;
      } else {
        qvVideoIframe.classList.add('hidden');
        qvVideoIframe.src = '';
        qvVideoEl.classList.remove('hidden');
        qvVideoEl.src = vid;
        qvVideoEl.load();
      }
    } else {
      qvVideoSection.classList.add('hidden');
      qvVideoEl.src = '';
      qvVideoIframe.src = '';
    }
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeQuickViewModal() {
  const modal = document.getElementById('quick-view-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
  // Pause and unload any video
  const qvVideoEl     = document.getElementById('qv-video-player');
  const qvVideoIframe = document.getElementById('qv-video-iframe');
  if (qvVideoEl)     { qvVideoEl.pause(); qvVideoEl.src = ''; }
  if (qvVideoIframe) { qvVideoIframe.src = ''; }
  activeQuickViewProduct = null;
}

// Cart Drawer Open/Close
function openCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-backdrop');
  if (drawer && backdrop) {
    backdrop.classList.remove('hidden');
    setTimeout(() => {
      backdrop.classList.remove('opacity-0');
      drawer.classList.remove('translate-x-full');
    }, 10);
    document.body.style.overflow = 'hidden';
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-backdrop');
  if (drawer && backdrop) {
    backdrop.classList.add('opacity-0');
    drawer.classList.add('translate-x-full');
    setTimeout(() => {
      backdrop.classList.add('hidden');
      document.body.style.overflow = '';
    }, 350);
  }
}

// Checkout Modal Open/Close & Tab Selection
function openCheckoutModal(defaultTab = 'cod') {
  const modal = document.getElementById('checkout-modal');
  if (!modal) return;

  const items = cartManager.getItems();
  if (items.length === 0) {
    showToast('Your cart is empty. Add a watch first!', 'info');
    return;
  }

  // Update Checkout Order Summary in modal
  renderCheckoutSummary();

  // Tab switching
  switchCheckoutTab(defaultTab);

  // Pre-fill Customer details if logged in
  if (currentCustomer) {
    const codName = document.getElementById('cod-name');
    const codPhone = document.getElementById('cod-phone');
    const codAltPhone = document.getElementById('cod-alt-phone');
    const codAddress = document.getElementById('cod-address');
    const codLandmark = document.getElementById('cod-landmark');
    const codCity = document.getElementById('cod-city');
    const codState = document.getElementById('cod-state');
    const codPincode = document.getElementById('cod-pincode');

    const waName = document.getElementById('wa-name');
    const waPhone = document.getElementById('wa-phone');
    const waAddress = document.getElementById('wa-address');
    const waCity = document.getElementById('wa-city');
    const waPincode = document.getElementById('wa-pincode');

    if (codName && !codName.value) codName.value = currentCustomer.name || '';
    if (codPhone && !codPhone.value) codPhone.value = currentCustomer.phone || '';
    if (codAltPhone && !codAltPhone.value && currentCustomer.altPhone) codAltPhone.value = currentCustomer.altPhone;
    if (codAddress && !codAddress.value && currentCustomer.address) codAddress.value = currentCustomer.address;
    if (codLandmark && !codLandmark.value && currentCustomer.landmark) codLandmark.value = currentCustomer.landmark;
    if (codCity && !codCity.value && currentCustomer.city) codCity.value = currentCustomer.city;
    if (codState && !codState.value && currentCustomer.state) codState.value = currentCustomer.state;
    if (codPincode && !codPincode.value && currentCustomer.pincode) codPincode.value = currentCustomer.pincode;

    if (waName && !waName.value) waName.value = currentCustomer.name || '';
    if (waPhone && !waPhone.value) waPhone.value = currentCustomer.phone || '';
    if (waAddress && !waAddress.value && currentCustomer.address) waAddress.value = currentCustomer.address;
    if (waCity && !waCity.value && currentCustomer.city) waCity.value = currentCustomer.city;
    if (waPincode && !waPincode.value && currentCustomer.pincode) waPincode.value = currentCustomer.pincode;
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function switchCheckoutTab(tabName) {
  const tabCodBtn = document.getElementById('tab-btn-cod');
  const tabWaBtn = document.getElementById('tab-btn-wa');
  const sectionCod = document.getElementById('checkout-section-cod');
  const sectionWa = document.getElementById('checkout-section-wa');

  if (tabName === 'cod') {
    if (tabCodBtn) {
      tabCodBtn.classList.remove('border-transparent', 'text-neutral-400');
      tabCodBtn.classList.add('border-amber-400', 'text-amber-400');
    }
    if (tabWaBtn) {
      tabWaBtn.classList.add('border-transparent', 'text-neutral-400');
      tabWaBtn.classList.remove('border-emerald-400', 'text-emerald-400');
    }
    if (sectionCod) sectionCod.classList.remove('hidden');
    if (sectionWa) sectionWa.classList.add('hidden');
  } else {
    if (tabWaBtn) {
      tabWaBtn.classList.remove('border-transparent', 'text-neutral-400');
      tabWaBtn.classList.add('border-emerald-400', 'text-emerald-400');
    }
    if (tabCodBtn) {
      tabCodBtn.classList.add('border-transparent', 'text-neutral-400');
      tabCodBtn.classList.remove('border-amber-400', 'text-amber-400');
    }
    if (sectionWa) sectionWa.classList.remove('hidden');
    if (sectionCod) sectionCod.classList.add('hidden');
  }
}

function renderCheckoutSummary() {
  const summaryItems = document.getElementById('checkout-summary-items');
  const summarySubtotal = document.getElementById('checkout-summary-subtotal');
  const summaryDiscount = document.getElementById('checkout-summary-discount');
  const summaryTotal = document.getElementById('checkout-summary-total');

  const items = cartManager.getItems();
  const subtotal = cartManager.getSubtotal();
  const discount = cartManager.getDiscount();
  const total = cartManager.getTotal();

  if (summaryItems) {
    summaryItems.innerHTML = items.map(item => `
      <div class="flex items-center justify-between text-xs py-1.5 border-b border-neutral-800/60">
        <div class="flex items-center gap-2 truncate pr-2">
          <span class="w-4 text-center font-bold text-neutral-400">${item.quantity}×</span>
          <span class="truncate text-neutral-200">${item.brand} ${item.model}</span>
        </div>
        <span class="font-semibold text-amber-400 flex-shrink-0">₹${(item.price * item.quantity).toLocaleString('en-IN')}</span>
      </div>
    `).join('');
  }

  if (summarySubtotal) summarySubtotal.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  
  if (summaryDiscount) {
    if (discount > 0) {
      summaryDiscount.parentElement.classList.remove('hidden');
      summaryDiscount.textContent = `-₹${discount.toLocaleString('en-IN')}`;
    } else {
      summaryDiscount.parentElement.classList.add('hidden');
    }
  }

  if (summaryTotal) summaryTotal.textContent = `₹${total.toLocaleString('en-IN')}`;
}

// Handle Cash On Delivery Form Submit
function handleCodFormSubmit() {
  const fullName = document.getElementById('cod-name').value.trim();
  const phone = document.getElementById('cod-phone').value.trim();
  const altPhone = document.getElementById('cod-alt-phone')?.value.trim() || '';
  const address = document.getElementById('cod-address').value.trim();
  const landmark = document.getElementById('cod-landmark')?.value.trim() || '';
  const city = document.getElementById('cod-city').value.trim();
  const state = document.getElementById('cod-state').value.trim();
  const pincode = document.getElementById('cod-pincode').value.trim();
  const notes = document.getElementById('cod-notes')?.value.trim() || '';

  if (!fullName || !phone || !address || !city || !state || !pincode) {
    showToast('Please fill in all required shipping fields.', 'error');
    return;
  }

  if (phone.replace(/[^0-9]/g, '').length < 10) {
    showToast('Please enter a valid 10-digit mobile number.', 'error');
    return;
  }

  const formData = {
    fullName,
    phone,
    altPhone,
    address,
    landmark,
    city,
    state,
    pincode,
    notes,
    customerEmail: currentCustomer ? currentCustomer.email : ''
  };

  checkoutManager.processCodOrder(formData);
}

// Handle Direct WhatsApp Order Form Submit
function handleWhatsAppFormSubmit() {
  const fullName = document.getElementById('wa-name')?.value.trim() || '';
  const phone = document.getElementById('wa-phone')?.value.trim() || '';
  const address = document.getElementById('wa-address')?.value.trim() || '';
  const city = document.getElementById('wa-city')?.value.trim() || '';
  const pincode = document.getElementById('wa-pincode')?.value.trim() || '';

  let customer = null;
  if (fullName || phone || address) {
    customer = {
      fullName: fullName || 'Customer',
      phone: phone || 'Provided on WhatsApp',
      address: address || 'Will provide on chat',
      city: city || '',
      state: '',
      pincode: pincode || ''
    };
  }

  const message = checkoutManager.buildCartWhatsAppMessage({ customer });
  checkoutManager.sendToWhatsApp(message);
  closeCheckoutModal();
}

// Store Phone Customizer
function handleStorePhoneChange() {
  const current = checkoutManager.getStorePhone();
  const newNumber = prompt("Enter the Store Owner's WhatsApp Number (with country code, e.g., 919876543210):", current);
  if (newNumber !== null && newNumber.trim() !== '') {
    const updated = checkoutManager.setStorePhone(newNumber);
    showToast(`Store WhatsApp updated to +${updated}`, 'success');
  }
}

// Mobile Menu
function setupMobileMenu() {
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }
}

// Luxury Toast Notification System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 transform translate-y-2 opacity-0 text-sm font-medium ${
    type === 'success' 
      ? 'bg-neutral-900/95 border-amber-500/50 text-amber-200' 
      : type === 'error' 
      ? 'bg-neutral-900/95 border-red-500/50 text-red-200' 
      : 'bg-neutral-900/95 border-neutral-700 text-neutral-200'
  }`;

  const icon = type === 'success' ? '✔' : type === 'error' ? '✖' : 'ℹ';
  toast.innerHTML = `
    <span class="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">${icon}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  // Auto dismiss
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

// =====================================================
// CUSTOMER PRIVILEGE AUTHENTICATION CONTROLLER
// (NO OTP REGISTER · GOOGLE SIGN-IN · MY ORDERS)
// =====================================================

function updateCustomerHeaderUI() {
  const authBtnText = document.getElementById('user-auth-btn-text');
  const avatarIcon = document.getElementById('user-avatar-icon');
  const mobileUserText = document.getElementById('mobile-user-text');
  const dropdownName = document.getElementById('user-dropdown-name');
  const dropdownEmail = document.getElementById('user-dropdown-email');

  if (currentCustomer) {
    const firstName = currentCustomer.name ? currentCustomer.name.split(' ')[0] : 'Member';
    if (authBtnText) authBtnText.textContent = firstName;
    if (mobileUserText) mobileUserText.textContent = `Hi, ${firstName} (View Account)`;
    if (dropdownName) dropdownName.textContent = currentCustomer.name || 'Privilege Member';
    if (dropdownEmail) dropdownEmail.textContent = currentCustomer.email || '';
    if (avatarIcon) {
      const initial = (currentCustomer.name || 'A').charAt(0).toUpperCase();
      avatarIcon.innerHTML = `<span class="font-luxury font-bold text-amber-400">${initial}</span>`;
    }
  } else {
    if (authBtnText) authBtnText.textContent = 'Sign In';
    if (mobileUserText) mobileUserText.textContent = 'Sign In / Create Account';
    if (avatarIcon) {
      avatarIcon.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>`;
    }
    const dropdown = document.getElementById('user-dropdown-menu');
    if (dropdown) dropdown.classList.add('hidden');
  }
}

function toggleUserDropdownOrOpenModal() {
  if (currentCustomer) {
    const dropdown = document.getElementById('user-dropdown-menu');
    if (dropdown) dropdown.classList.toggle('hidden');
  } else {
    openAuthModal('register');
  }
}

function openAuthModal(defaultTab = 'register') {
  const modal = document.getElementById('customer-auth-modal');
  if (!modal) return;
  switchAuthTab(defaultTab);
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  const modal = document.getElementById('customer-auth-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function switchAuthTab(tab) {
  const tabReg = document.getElementById('tab-btn-register');
  const tabSign = document.getElementById('tab-btn-signin');
  const formReg = document.getElementById('customer-register-form');
  const formSign = document.getElementById('customer-signin-form');

  if (tab === 'register') {
    if (tabReg) {
      tabReg.className = 'py-2 rounded-lg bg-amber-500 text-black shadow-md transition-all uppercase tracking-wider font-bold';
    }
    if (tabSign) {
      tabSign.className = 'py-2 rounded-lg text-neutral-400 hover:text-white transition-all uppercase tracking-wider font-bold';
    }
    if (formReg) formReg.classList.remove('hidden');
    if (formSign) formSign.classList.add('hidden');
  } else {
    if (tabSign) {
      tabSign.className = 'py-2 rounded-lg bg-amber-500 text-black shadow-md transition-all uppercase tracking-wider font-bold';
    }
    if (tabReg) {
      tabReg.className = 'py-2 rounded-lg text-neutral-400 hover:text-white transition-all uppercase tracking-wider font-bold';
    }
    if (formSign) formSign.classList.remove('hidden');
    if (formReg) formReg.classList.add('hidden');
  }
}

// Handle Register (No OTP!)
async function handleCustomerRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone')?.value.trim() || '';
  const password = document.getElementById('reg-password').value.trim();

  if (!name || !email || !password) {
    showToast('Please fill in Name, Email, and Password.', 'error');
    return;
  }

  try {
    showToast('Creating your AM Privilege account...', 'info');
    const res = await fetch('/api/customer/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      currentCustomer = data.user;
      localStorage.setItem('amc_customer', JSON.stringify(currentCustomer));
      updateCustomerHeaderUI();
      closeAuthModal();
      showToast(data.message || `Account created! Welcome, ${name}! ✨`, 'success');
    } else {
      showToast(data.error || 'Registration failed. Try signing in.', 'error');
    }
  } catch (err) {
    // Local / offline fallback
    const offlineUser = {
      userId: `AMC-LOCAL-${Date.now().toString().slice(-4)}`,
      name,
      email,
      phone
    };
    currentCustomer = offlineUser;
    localStorage.setItem('amc_customer', JSON.stringify(offlineUser));
    updateCustomerHeaderUI();
    closeAuthModal();
    showToast(`Welcome, ${name}! (Account created locally) ✨`, 'success');
  }
}

// Handle Sign In
async function handleCustomerLogin(e) {
  e.preventDefault();
  const email = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value.trim();

  if (!email || !password) {
    showToast('Please enter both Email and Password.', 'error');
    return;
  }

  try {
    showToast('Signing in...', 'info');
    const res = await fetch('/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      currentCustomer = data.user;
      localStorage.setItem('amc_customer', JSON.stringify(currentCustomer));
      updateCustomerHeaderUI();
      closeAuthModal();
      showToast(data.message || `Welcome back, ${data.user.name}! 👑`, 'success');
    } else {
      showToast(data.error || 'Invalid credentials. Please check and retry.', 'error');
    }
  } catch (err) {
    showToast('Server connection error. Please try again.', 'error');
  }
}

// =====================================================
// USER PROFILE & ADDRESS CONTROLLER
// =====================================================

function openProfileModal() {
  const modal = document.getElementById('customer-profile-modal');
  if (!modal) return;

  if (!currentCustomer) {
    openAuthModal('signin');
    return;
  }

  // Populate form with current customer details
  const nameInput = document.getElementById('prof-name');
  const phoneInput = document.getElementById('prof-phone');
  const emailInput = document.getElementById('prof-email');
  const addressInput = document.getElementById('prof-address');
  const cityInput = document.getElementById('prof-city');
  const stateInput = document.getElementById('prof-state');
  const pincodeInput = document.getElementById('prof-pincode');
  const headingName = document.getElementById('profile-heading-name');
  const avatarBadge = document.getElementById('profile-avatar-badge');

  if (nameInput) nameInput.value = currentCustomer.name || '';
  if (phoneInput) phoneInput.value = currentCustomer.phone || '';
  if (emailInput) emailInput.value = currentCustomer.email || '';
  if (addressInput) addressInput.value = currentCustomer.address || '';
  if (cityInput) cityInput.value = currentCustomer.city || '';
  if (stateInput) stateInput.value = currentCustomer.state || '';
  if (pincodeInput) pincodeInput.value = currentCustomer.pincode || '';

  if (headingName) headingName.textContent = currentCustomer.name || 'Patron Profile';
  if (avatarBadge) {
    const initial = (currentCustomer.name || 'A').charAt(0).toUpperCase();
    avatarBadge.textContent = initial;
  }

  // Close dropdown if open
  const dropdown = document.getElementById('user-dropdown-menu');
  if (dropdown) dropdown.classList.add('hidden');

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeProfileModal() {
  const modal = document.getElementById('customer-profile-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

async function handleProfileUpdate(e) {
  if (e) e.preventDefault();

  if (!currentCustomer) {
    showToast('Please sign in to update your profile.', 'error');
    return;
  }

  const name = document.getElementById('prof-name')?.value.trim();
  const phone = document.getElementById('prof-phone')?.value.trim();
  const address = document.getElementById('prof-address')?.value.trim();
  const city = document.getElementById('prof-city')?.value.trim();
  const state = document.getElementById('prof-state')?.value.trim();
  const pincode = document.getElementById('prof-pincode')?.value.trim();

  if (!name) {
    showToast('Please enter your full name.', 'error');
    return;
  }

  const payload = {
    email: currentCustomer.email,
    name,
    phone,
    address,
    city,
    state,
    pincode
  };

  try {
    showToast('Saving your profile...', 'info');
    const res = await fetch('/api/customer/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      currentCustomer = data.user;
      localStorage.setItem('amc_customer', JSON.stringify(currentCustomer));
      updateCustomerHeaderUI();
      closeProfileModal();
      showToast('Profile & Address updated successfully! ✨', 'success');
    } else {
      showToast(data.error || 'Failed to save profile.', 'error');
    }
  } catch (err) {
    // Offline / local storage fallback
    currentCustomer = { ...currentCustomer, name, phone, address, city, state, pincode };
    localStorage.setItem('amc_customer', JSON.stringify(currentCustomer));
    updateCustomerHeaderUI();
    closeProfileModal();
    showToast('Profile saved locally! ✨', 'success');
  }
}

function handleCustomerLogout() {
  currentCustomer = null;
  localStorage.removeItem('amc_customer');
  updateCustomerHeaderUI();
  showToast('You have signed out of your AM Privilege account.', 'info');
}

// Customer My Orders Modal
async function openMyOrdersModal() {
  const modal = document.getElementById('customer-orders-modal');
  const container = document.getElementById('customer-orders-list');
  if (!modal || !container) return;

  if (!currentCustomer) {
    openAuthModal('signin');
    return;
  }

  modal.classList.remove('hidden');
  container.innerHTML = `
    <div class="p-8 text-center text-neutral-400">
      <span class="animate-spin inline-block text-2xl mb-2">⏳</span>
      <p class="text-xs">Loading your order history...</p>
    </div>
  `;

  try {
    const identifier = currentCustomer.email || currentCustomer.phone || '';
    const res = await fetch(`/api/customer/orders/${encodeURIComponent(identifier)}`);
    const orders = await res.json();

    if (!Array.isArray(orders) || orders.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-neutral-500 space-y-2">
          <div class="text-3xl">📦</div>
          <p class="text-sm font-bold text-neutral-300">No Orders Placed Yet</p>
          <p class="text-xs">Browse our Master Copy collection and place your first Cash on Delivery order!</p>
          <button onclick="closeMyOrdersModal(); window.location.href='#catalog';" class="mt-4 px-6 py-2.5 rounded-xl gold-btn text-xs font-bold uppercase tracking-wider">
            Explore Collection
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(o => `
      <div class="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs font-bold text-amber-400">${o.orderId}</span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            o.status && o.status.includes('Delivered') ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
            o.status && o.status.includes('Shipped') ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
            'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }">${o.status || 'Confirmed'}</span>
        </div>
        <div class="text-[11px] text-neutral-400 flex justify-between">
          <span>Date: ${new Date(o.createdAt || o.date || Date.now()).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
          <span>Payment: <strong>Cash on Delivery (COD)</strong></span>
        </div>
        <div class="border-t border-neutral-800/80 pt-2 space-y-1">
          ${(o.items || []).map(it => `
            <div class="flex justify-between text-xs text-neutral-200">
              <span>${it.quantity}× ${it.brand || ''} ${it.model || 'Watch'}</span>
              <span class="font-semibold text-amber-400">₹${((it.price || 0) * (it.quantity || 1)).toLocaleString('en-IN')}</span>
            </div>
          `).join('')}
        </div>
        <div class="border-t border-neutral-800/80 pt-2 flex justify-between text-xs font-bold">
          <span class="text-neutral-400">Total Bill:</span>
          <span class="text-white">₹${Number(o.total || 0).toLocaleString('en-IN')}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `
      <div class="p-6 text-center text-red-400 text-xs">
        Failed to fetch orders. Please check your connection.
      </div>
    `;
  }
}

function closeMyOrdersModal() {
  const modal = document.getElementById('customer-orders-modal');
  if (modal) modal.classList.add('hidden');
}
