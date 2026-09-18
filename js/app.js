// AM COLLECTION - Main Application Controller (Production Indian E-Commerce)

let liveProducts = (typeof PRODUCTS_DATA !== 'undefined') ? [...PRODUCTS_DATA] : [];
let activeCategory = 'all';
let searchQuery = '';
let currentSort = 'featured';
let activeQuickViewProduct = null;
window.pendingCheckoutAction = null;

// Customer Privilege Authentication State
let currentCustomer = null;
try {
  currentCustomer = JSON.parse(localStorage.getItem('amc_customer') || 'null');
} catch (e) {
  currentCustomer = null;
}

// Wishlist State
function getWishlist() {
  try {
    return JSON.parse(localStorage.getItem('amc_wishlist') || '[]');
  } catch (e) {
    return [];
  }
}

function isWishlisted(productId) {
  return getWishlist().includes(productId);
}

function toggleWishlist(productId, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  let list = getWishlist();
  const idx = list.indexOf(productId);
  if (idx > -1) {
    list.splice(idx, 1);
    showToast('Removed from your Wishlist', 'info');
  } else {
    list.push(productId);
    showToast('Added to your Wishlist ❤️', 'success');
  }
  localStorage.setItem('amc_wishlist', JSON.stringify(list));
  updateWishlistUI();
  renderProducts();
}

function updateWishlistUI() {
  const count = getWishlist().length;
  document.querySelectorAll('.wishlist-count-badge').forEach(el => {
    el.textContent = count;
    if (count > 0) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

function openWishlistModal() {
  const modal = document.getElementById('wishlist-modal');
  const container = document.getElementById('wishlist-items-container');
  if (!modal || !container) return;

  const list = getWishlist();
  const wishlistedProducts = liveProducts.filter(p => list.includes(p.id));

  if (wishlistedProducts.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center">
        <div class="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400 mb-3">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
        </div>
        <p class="text-sm font-semibold text-neutral-800">Your Wishlist is Empty</p>
        <p class="text-xs text-neutral-500 mt-1">Explore our Master Copy collection and tap the heart icon to save timepieces.</p>
        <button onclick="closeWishlistModal(); window.location.href='#catalog';" class="btn-primary mt-4 px-5 py-2 text-xs">
          Explore Watches
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
        ${wishlistedProducts.map(p => `
          <div class="bg-white border border-neutral-200 rounded-xl p-3 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div class="relative aspect-square w-full bg-white flex items-center justify-center mb-2 cursor-pointer" onclick="closeWishlistModal(); openQuickView('${p.id}')">
              <img src="${p.image}" alt="${p.model}" class="w-full h-full object-contain" />
            </div>
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-neutral-500">${p.brand}</span>
              <h4 class="text-xs font-semibold text-neutral-900 line-clamp-1">${p.model}</h4>
              <div class="text-xs font-bold text-neutral-900 mt-1">₹${p.price.toLocaleString('en-IN')}</div>
            </div>
            <div class="flex items-center gap-2 mt-3 pt-2 border-t border-neutral-100">
              <button onclick="addToCart('${p.id}'); closeWishlistModal(); openCartDrawer();" class="flex-1 btn-primary py-1.5 text-[11px]">
                Add to Bag
              </button>
              <button onclick="toggleWishlist('${p.id}'); openWishlistModal();" class="p-1.5 text-neutral-400 hover:text-red-500 transition-colors" title="Remove">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeWishlistModal() {
  const modal = document.getElementById('wishlist-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Cart UI
  cartManager.renderCartUI();

  // Initialize Customer Auth UI
  updateCustomerHeaderUI();

  // Initialize Wishlist UI
  updateWishlistUI();

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
      if (Array.isArray(prods)) {
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
  const img = document.getElementById('header-logo-img');
  const monogram = document.getElementById('header-logo-monogram');
  if (settings.logoUrl) {
    if (img && monogram) {
      img.src = settings.logoUrl;
      img.classList.remove('hidden');
      monogram.classList.add('hidden');
    }
  } else {
    if (img && monogram) {
      img.src = '';
      img.classList.add('hidden');
      monogram.classList.remove('hidden');
    }
  }
}

// Setup All DOM Event Listeners
function setupEventListeners() {
  // Search Input
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear-btn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      if (searchClear) {
        if (searchQuery.length > 0) searchClear.classList.remove('hidden');
        else searchClear.classList.add('hidden');
      }
      renderProducts();
    });
  }
  if (searchClear && searchInput) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClear.classList.add('hidden');
      renderProducts();
      searchInput.focus();
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
        b.classList.remove('bg-[#111111]', 'text-white', 'border-[#111111]');
        b.classList.add('bg-white', 'text-neutral-700', 'border-neutral-200');
      });

      const target = e.currentTarget;
      target.classList.remove('bg-white', 'text-neutral-700', 'border-neutral-200');
      target.classList.add('bg-[#111111]', 'text-white', 'border-[#111111]');

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

  // COD Checkout Modal Trigger (WITH AUTHENTICATION GUARD)
  const codTriggerBtn = document.getElementById('cart-checkout-cod-btn');
  if (codTriggerBtn) {
    codTriggerBtn.addEventListener('click', () => {
      closeCartDrawer();
      if (!currentCustomer) {
        window.pendingCheckoutAction = { type: 'checkout', tab: 'cod' };
        showToast('Please sign in or create an account to proceed with your order.', 'info');
        openAuthModal('signin');
        return;
      }
      openCheckoutModal('cod');
    });
  }

  // WhatsApp Checkout Modal / Action (WITH AUTHENTICATION GUARD)
  const cartWaBtn = document.getElementById('cart-checkout-wa-btn');
  if (cartWaBtn) {
    cartWaBtn.addEventListener('click', () => {
      closeCartDrawer();
      if (!currentCustomer) {
        window.pendingCheckoutAction = { type: 'checkout', tab: 'wa' };
        showToast('Please sign in or create an account to proceed with your order.', 'info');
        openAuthModal('signin');
        return;
      }
      openCheckoutModal('wa');
    });
  }

  // Checkout Modal Close
  const checkoutCloseBtn = document.getElementById('checkout-modal-close');
  if (checkoutCloseBtn) checkoutCloseBtn.addEventListener('click', closeCheckoutModal);

  // Quick View Modal Close
  const qvCloseBtn = document.getElementById('quick-view-close-btn');
  if (qvCloseBtn) qvCloseBtn.addEventListener('click', closeQuickViewModal);

  // Quick View Backdrop click
  const qvModal = document.getElementById('quick-view-modal');
  if (qvModal) {
    qvModal.addEventListener('click', (e) => {
      if (e.target === qvModal) closeQuickViewModal();
    });
  }

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCartDrawer();
      closeCheckoutModal();
      closeQuickViewModal();
      closeAuthModal();
      closeProfileModal();
      closeMyOrdersModal();
      closeWishlistModal();
    }
  });

  // COD Order Form Submit
  const codForm = document.getElementById('checkout-cod-form');
  if (codForm) codForm.addEventListener('submit', handleCodFormSubmit);

  // WhatsApp Order Form Submit
  const waForm = document.getElementById('checkout-wa-form');
  if (waForm) waForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleWhatsAppFormSubmit();
  });

  // Cart Coupon Form
  const couponForm = document.getElementById('cart-coupon-form');
  if (couponForm) {
    couponForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = document.getElementById('coupon-input').value.trim().toUpperCase();
      if (!code) return;
      
      if (code === 'WELCOME500' || code === 'PRIVILEGE500') {
        cartManager.saveCoupon(code);
        showToast(`Promo code '${code}' applied! ₹500 discount added.`, 'success');
      } else {
        showToast('Invalid promo code. Use WELCOME500 for ₹500 OFF.', 'error');
      }
    });
  }

  // Customer Privilege Auth Forms
  const regForm = document.getElementById('customer-register-form');
  if (regForm) regForm.addEventListener('submit', handleCustomerRegister);

  const signinForm = document.getElementById('customer-signin-form');
  if (signinForm) signinForm.addEventListener('submit', handleCustomerLogin);

  const profileForm = document.getElementById('customer-profile-form');
  if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);
}

// 4-Column Responsive Product Card Renderer
function renderProducts() {
  const container = document.getElementById('products-grid');
  const countBadge = document.getElementById('products-count-badge');
  if (!container) return;

  // Filter by category
  let filtered = [...liveProducts];
  if (activeCategory !== 'all') {
    filtered = filtered.filter(p => p.category === activeCategory);
  }

  // Filter by search query
  if (searchQuery) {
    filtered = filtered.filter(p => 
      p.brand.toLowerCase().includes(searchQuery) ||
      p.model.toLowerCase().includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery) ||
      (p.movement && p.movement.toLowerCase().includes(searchQuery))
    );
  }

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

  // Update counter
  if (countBadge) {
    countBadge.textContent = `Showing ${filtered.length} ${filtered.length === 1 ? 'timepiece' : 'timepieces'}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-4 py-16 text-center">
        <div class="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400 mb-4 border border-neutral-200">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <h3 class="text-base font-bold text-neutral-900 mb-1">No matching watches found</h3>
        <p class="text-xs text-neutral-500 mb-6 max-w-sm mx-auto">We couldn't find any watches matching your criteria. Try adjusting your search or filters.</p>
        <button onclick="resetFilters()" class="btn-primary px-5 py-2 text-xs">
          Reset All Filters
        </button>
      </div>
    `;
    return;
  }

  // Compact 4-Column Product Cards (Strictly 4 per row, equal heights, centered images, mobile-optimized)
  container.innerHTML = filtered.map(product => {
    const savingsPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    const wishlisted = isWishlisted(product.id);

    return `
      <div class="product-card group relative bg-white border border-[#E5E7EB] rounded-xl hover:border-neutral-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden">
        
        <!-- Image Area (Fixed Ratio, Contain, Centered) -->
        <div onclick="openQuickView('${product.id}')" class="product-image-container relative aspect-square w-full cursor-pointer bg-white p-2 sm:p-3 flex items-center justify-center overflow-hidden">
          <img 
            src="${product.image}" 
            alt="${product.brand} ${product.model}" 
            loading="lazy" 
            class="w-full h-full object-contain object-center transition-transform duration-300 group-hover:scale-105"
            onerror="this.src='https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop'"
          />
          
          <!-- Top Left Badge -->
          <div class="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex flex-col gap-1 z-10">
            <span class="px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold tracking-wider uppercase bg-neutral-900 text-white rounded shadow-sm">
              ${product.badge || '1:1 CLONE'}
            </span>
          </div>

          <!-- Wishlist Heart Button Top Right -->
          <button 
            type="button"
            onclick="toggleWishlist('${product.id}', event)"
            class="wishlist-btn absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center z-20 ${wishlisted ? 'active' : ''}"
            title="${wishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}"
            aria-label="Wishlist"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 ${wishlisted ? 'text-red-500 fill-red-500' : 'text-neutral-500 hover:text-red-500'}" fill="${wishlisted ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
            </svg>
          </button>
        </div>

        <!-- Product Details -->
        <div class="p-2 sm:p-3 flex-1 flex flex-col justify-between border-t border-neutral-100">
          <div>
            <!-- Brand & Rating Row -->
            <div class="flex items-center justify-between gap-1 mb-0.5">
              <span class="text-[9px] sm:text-[10px] font-bold tracking-wider uppercase text-neutral-500 truncate" onclick="openQuickView('${product.id}')">${product.brand}</span>
              <div class="flex items-center gap-0.5 text-[9px] sm:text-[10px] text-neutral-600 font-semibold flex-shrink-0">
                <span class="text-amber-500">★</span>
                <span>${product.rating}</span>
              </div>
            </div>

            <!-- Model Title (Max 2 lines) -->
            <h3 
              onclick="openQuickView('${product.id}')"
              class="text-[10px] sm:text-xs font-semibold text-neutral-900 hover:text-neutral-700 line-clamp-2 leading-tight cursor-pointer min-h-[26px] sm:min-h-[32px]"
              title="${product.model}"
            >
              ${product.model}
            </h3>

            <!-- Price Block -->
            <div class="mt-1 flex flex-wrap items-baseline gap-1">
              <span class="text-xs sm:text-sm font-bold text-neutral-900">₹${product.price.toLocaleString('en-IN')}</span>
              <span class="text-[9px] sm:text-[10px] text-neutral-400 line-through">₹${product.originalPrice.toLocaleString('en-IN')}</span>
              <span class="text-[9px] sm:text-[10px] font-bold text-[#15803D]">${savingsPercent}% OFF</span>
            </div>
          </div>

          <!-- Compact Action Area -->
          <div class="mt-2.5 pt-2 border-t border-neutral-100 flex items-center gap-1.5">
            <button 
              type="button"
              onclick="addToCart('${product.id}'); openCartDrawer();"
              class="flex-1 py-1.5 sm:py-2 px-2 rounded-md bg-[#111111] hover:bg-black text-white text-[10px] sm:text-xs font-medium transition-colors flex items-center justify-center gap-1"
            >
              <svg class="w-3.5 h-3.5 hidden sm:inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
              <span>Add to Bag</span>
            </button>
            <button 
              type="button"
              onclick="buyNow('${product.id}')"
              class="py-1.5 sm:py-2 px-2 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[10px] sm:text-xs font-semibold transition-colors"
              title="Buy Now (Cash on Delivery)"
            >
              Buy Now
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

  const searchClear = document.getElementById('search-clear-btn');
  if (searchClear) searchClear.classList.add('hidden');

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = 'featured';

  document.querySelectorAll('.category-filter-btn').forEach(b => {
    if (b.getAttribute('data-category') === 'all') {
      b.classList.remove('bg-white', 'text-neutral-700', 'border-neutral-200');
      b.classList.add('bg-[#111111]', 'text-white', 'border-[#111111]');
    } else {
      b.classList.remove('bg-[#111111]', 'text-white', 'border-[#111111]');
      b.classList.add('bg-white', 'text-neutral-700', 'border-neutral-200');
    }
  });

  renderProducts();
}

// Add To Cart Wrapper
function addToCart(productId, quantity = 1) {
  const product = liveProducts.find(p => p.id === productId);
  if (!product) return;
  cartManager.addItem(product, quantity);
  showToast(`${product.model} added to your bag! 🛍️`, 'success');
}

// BUY NOW (WITH MANDATORY AUTHENTICATION REQUIREMENT)
function buyNow(productId) {
  const product = liveProducts.find(p => p.id === productId);
  if (!product) return;

  // Preserve in cart
  cartManager.addItem(product, 1);

  // Authenticate before allowing order
  if (!currentCustomer) {
    window.pendingCheckoutAction = { type: 'checkout', tab: 'cod', productId };
    showToast('Please sign in or create an account to proceed with your order.', 'info');
    openAuthModal('signin');
    return;
  }

  // User is authenticated -> proceed to checkout directly
  openCheckoutModal('cod');
}

// Direct WhatsApp Buy (Also checks auth or proceeds directly)
function directWhatsAppBuy(productId) {
  const product = liveProducts.find(p => p.id === productId);
  if (!product) return;
  checkoutManager.quickBuyWhatsApp(product);
}

// Quick View / Full Inspection Modal Open
function openQuickView(productId) {
  const product = liveProducts.find(p => p.id === productId);
  if (!product) return;

  activeQuickViewProduct = product;
  const modal = document.getElementById('quick-view-modal');
  if (!modal) return;

  const savingsPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);

  // Bind Data
  const imgEl = document.getElementById('qv-image');
  if (imgEl) {
    imgEl.src = product.image;
    imgEl.alt = `${product.brand} ${product.model}`;
  }

  const brandEl = document.getElementById('qv-brand');
  if (brandEl) brandEl.textContent = product.brand.toUpperCase();

  const modelEl = document.getElementById('qv-model');
  if (modelEl) modelEl.textContent = product.model;

  const taglineEl = document.getElementById('qv-tagline');
  if (taglineEl) taglineEl.textContent = product.tagline || '1:1 Master Copy Horology Clone';

  const priceEl = document.getElementById('qv-price');
  if (priceEl) priceEl.textContent = `₹${product.price.toLocaleString('en-IN')}`;

  const origPriceEl = document.getElementById('qv-original-price');
  if (origPriceEl) origPriceEl.textContent = `₹${product.originalPrice.toLocaleString('en-IN')}`;

  const descEl = document.getElementById('qv-description');
  if (descEl) descEl.textContent = product.description || 'Precision crafted 1:1 master copy with exact weight, materials, and Japanese automatic caliber.';

  const badgeEl = document.getElementById('qv-badge');
  if (badgeEl) badgeEl.textContent = product.badge || 'MASTER EDITION';

  const ratingValEl = document.getElementById('qv-rating-val');
  if (ratingValEl) ratingValEl.textContent = `${product.rating} (${product.reviewsCount} verified reviews)`;

  const savingsBadgeEl = document.getElementById('qv-savings-badge');
  if (savingsBadgeEl) savingsBadgeEl.textContent = `Save ${savingsPercent}% (₹${(product.originalPrice - product.price).toLocaleString('en-IN')})`;

  // Specs Table
  const movementEl = document.getElementById('qv-spec-movement');
  if (movementEl) movementEl.textContent = product.movement || 'Japanese Automatic Caliber';

  const dialEl = document.getElementById('qv-spec-dial');
  if (dialEl) dialEl.textContent = product.dialSize || '40-41 mm Standard';

  const glassEl = document.getElementById('qv-spec-glass');
  if (glassEl) glassEl.textContent = product.glass || 'Sapphire Coated Scratch-Resistant';

  const strapEl = document.getElementById('qv-spec-strap');
  if (strapEl) strapEl.textContent = product.strap || '904L Solid Stainless Steel';

  const waterEl = document.getElementById('qv-spec-water');
  if (waterEl) waterEl.textContent = product.waterResistance || 'Daily Splash & Rain Proof';

  const claspEl = document.getElementById('qv-spec-clasp');
  if (claspEl) claspEl.textContent = product.clasp || 'Authentic Double Folding Lock';

  // Features List
  const featuresList = document.getElementById('qv-features-list');
  if (featuresList && Array.isArray(product.features)) {
    featuresList.innerHTML = product.features.map(f => `
      <li class="flex items-start gap-2 text-xs text-neutral-700">
        <span class="text-emerald-600 font-bold mt-0.5">✔</span>
        <span>${f}</span>
      </li>
    `).join('');
  }

  // BUY NOW Button (Guarded by Auth)
  const buyNowBtn = document.getElementById('qv-buy-now-btn');
  if (buyNowBtn) {
    buyNowBtn.onclick = () => {
      closeQuickViewModal();
      buyNow(product.id);
    };
  }

  // Add to Bag Button
  const addBtn = document.getElementById('qv-add-to-cart-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      addToCart(product.id, 1);
      closeQuickViewModal();
      openCartDrawer();
    };
  }

  // WhatsApp Button
  const waBtn = document.getElementById('qv-whatsapp-btn');
  if (waBtn) {
    waBtn.onclick = () => {
      directWhatsAppBuy(product.id);
    };
  }

  // Video Section
  const qvVideoSection = document.getElementById('qv-video-section');
  const qvVideoEl = document.getElementById('qv-video-player');
  const qvVideoIframe = document.getElementById('qv-video-iframe');

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
  const qvVideoEl = document.getElementById('qv-video-player');
  const qvVideoIframe = document.getElementById('qv-video-iframe');
  if (qvVideoEl) { qvVideoEl.pause(); qvVideoEl.src = ''; }
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
    }, 300);
  }
}

// Checkout Modal (WITH AUTHENTICATION GUARD)
function openCheckoutModal(defaultTab = 'cod') {
  if (!currentCustomer) {
    window.pendingCheckoutAction = { type: 'checkout', tab: defaultTab };
    showToast('Please sign in to access checkout.', 'info');
    openAuthModal('signin');
    return;
  }

  const modal = document.getElementById('checkout-modal');
  if (!modal) return;

  const items = cartManager.getItems();
  if (items.length === 0) {
    showToast('Your cart is empty. Add a timepiece first!', 'info');
    return;
  }

  // Update Summary
  const summaryContainer = document.getElementById('checkout-items-summary');
  if (summaryContainer) {
    summaryContainer.innerHTML = items.map(item => `
      <div class="flex items-center justify-between text-xs py-1.5 border-b border-neutral-100">
        <div class="flex items-center gap-2">
          <span class="w-4 text-center font-bold text-neutral-500">${item.quantity}×</span>
          <span class="font-medium text-neutral-800 truncate max-w-[200px]">${item.brand} ${item.model}</span>
        </div>
        <span class="font-semibold text-neutral-900">₹${(item.price * item.quantity).toLocaleString('en-IN')}</span>
      </div>
    `).join('');
  }

  const subtotalEl = document.getElementById('checkout-subtotal-val');
  if (subtotalEl) subtotalEl.textContent = `₹${cartManager.getSubtotal().toLocaleString('en-IN')}`;

  const discountEl = document.getElementById('checkout-discount-val');
  const discountRow = document.getElementById('checkout-discount-row');
  const discount = cartManager.getDiscount();
  if (discountRow && discountEl) {
    if (discount > 0) {
      discountRow.classList.remove('hidden');
      discountEl.textContent = `-₹${discount.toLocaleString('en-IN')}`;
    } else {
      discountRow.classList.add('hidden');
    }
  }

  const totalEl = document.getElementById('checkout-total-val');
  if (totalEl) totalEl.textContent = `₹${cartManager.getTotal().toLocaleString('en-IN')}`;

  // Pre-fill Customer Profile Info
  const nameInput = document.getElementById('cod-name');
  const phoneInput = document.getElementById('cod-phone');
  const addressInput = document.getElementById('cod-address');
  const cityInput = document.getElementById('cod-city');
  const stateInput = document.getElementById('cod-state');
  const pincodeInput = document.getElementById('cod-pincode');

  if (nameInput && currentCustomer.name) nameInput.value = currentCustomer.name;
  if (phoneInput && currentCustomer.phone) phoneInput.value = currentCustomer.phone;
  if (addressInput && currentCustomer.address) addressInput.value = currentCustomer.address;
  if (cityInput && currentCustomer.city) cityInput.value = currentCustomer.city;
  if (stateInput && currentCustomer.state) stateInput.value = currentCustomer.state;
  if (pincodeInput && currentCustomer.pincode) pincodeInput.value = currentCustomer.pincode;

  switchCheckoutTab(defaultTab);
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

function switchCheckoutTab(tab) {
  const btnCod = document.getElementById('tab-btn-cod');
  const btnWa = document.getElementById('tab-btn-wa');
  const contentCod = document.getElementById('tab-content-cod');
  const contentWa = document.getElementById('tab-content-wa');

  if (tab === 'cod') {
    if (btnCod) btnCod.className = 'py-3 text-center border-b-2 border-neutral-900 text-neutral-900 font-bold transition-colors';
    if (btnWa) btnWa.className = 'py-3 text-center border-b-2 border-transparent text-neutral-500 hover:text-neutral-900 font-semibold transition-colors';
    if (contentCod) contentCod.classList.remove('hidden');
    if (contentWa) contentWa.classList.add('hidden');
  } else {
    if (btnWa) btnWa.className = 'py-3 text-center border-b-2 border-emerald-600 text-emerald-700 font-bold transition-colors';
    if (btnCod) btnCod.className = 'py-3 text-center border-b-2 border-transparent text-neutral-500 hover:text-neutral-900 font-semibold transition-colors';
    if (contentWa) contentWa.classList.remove('hidden');
    if (contentCod) contentCod.classList.add('hidden');
  }
}

// Handle COD Order Submission
async function handleCodFormSubmit(e) {
  e.preventDefault();

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
    showToast('Please fill all required address fields.', 'error');
    return;
  }

  const phoneRegex = /^[6-9]\d{9}$/;
  const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
  if (!phoneRegex.test(cleanPhone)) {
    showToast('Please enter a valid 10-digit Indian mobile number.', 'error');
    return;
  }

  const pinRegex = /^[1-9][0-9]{5}$/;
  if (!pinRegex.test(pincode.replace(/\s/g, ''))) {
    showToast('Please enter a valid 6-digit Indian Pincode.', 'error');
    return;
  }

  const formData = {
    fullName,
    phone: cleanPhone,
    altPhone,
    address,
    landmark,
    city,
    state,
    pincode,
    notes,
    customerEmail: currentCustomer ? currentCustomer.email : ''
  };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  checkoutManager.processCodOrder(formData, submitBtn);
}

// Handle WhatsApp Order Form Submit
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

// Production-Grade Clean Toast Notification System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg transition-all duration-200 transform translate-y-2 opacity-0 text-xs font-semibold ${
    type === 'success' 
      ? 'bg-white border-emerald-300 text-emerald-900' 
      : type === 'error' 
      ? 'bg-white border-red-300 text-red-900' 
      : 'bg-white border-neutral-300 text-neutral-900'
  }`;

  const icon = type === 'success' 
    ? '<span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">✔</span>'
    : type === 'error' 
    ? '<span class="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">✕</span>'
    : '<span class="w-5 h-5 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold text-xs">ℹ</span>';

  toast.innerHTML = `
    ${icon}
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// Customer Auth Header Update
function updateCustomerHeaderUI() {
  const authBtnText = document.getElementById('user-auth-btn-text');
  const avatarIcon = document.getElementById('user-avatar-icon');
  const mobileUserText = document.getElementById('mobile-user-text');
  const dropdownName = document.getElementById('user-dropdown-name');
  const dropdownEmail = document.getElementById('user-dropdown-email');

  if (currentCustomer) {
    const firstName = currentCustomer.name ? currentCustomer.name.split(' ')[0] : 'Member';
    if (authBtnText) authBtnText.textContent = firstName;
    if (mobileUserText) mobileUserText.textContent = `Hi, ${firstName} (Account)`;
    if (dropdownName) dropdownName.textContent = currentCustomer.name || 'Privilege Member';
    if (dropdownEmail) dropdownEmail.textContent = currentCustomer.email || '';
    if (avatarIcon) {
      const initial = (currentCustomer.name || 'A').charAt(0).toUpperCase();
      avatarIcon.innerHTML = `<span class="font-bold text-neutral-900 text-xs">${initial}</span>`;
    }
  } else {
    if (authBtnText) authBtnText.textContent = 'Sign In';
    if (mobileUserText) mobileUserText.textContent = 'Sign In / Register';
    if (avatarIcon) {
      avatarIcon.innerHTML = `<svg class="w-3.5 h-3.5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>`;
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
    openAuthModal('signin');
  }
}

function openAuthModal(defaultTab = 'signin') {
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
    if (tabReg) tabReg.className = 'py-2 rounded-lg bg-neutral-900 text-white font-semibold text-xs transition-all';
    if (tabSign) tabSign.className = 'py-2 rounded-lg text-neutral-500 hover:text-neutral-900 font-medium text-xs transition-all';
    if (formReg) formReg.classList.remove('hidden');
    if (formSign) formSign.classList.add('hidden');
  } else {
    if (tabSign) tabSign.className = 'py-2 rounded-lg bg-neutral-900 text-white font-semibold text-xs transition-all';
    if (tabReg) tabReg.className = 'py-2 rounded-lg text-neutral-500 hover:text-neutral-900 font-medium text-xs transition-all';
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
    showToast('Creating your account...', 'info');
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

      // Check for pending order action
      if (window.pendingCheckoutAction) {
        const pending = window.pendingCheckoutAction;
        window.pendingCheckoutAction = null;
        showToast(`Welcome, ${name}! Continuing with your order...`, 'success');
        setTimeout(() => openCheckoutModal(pending.tab || 'cod'), 200);
      } else {
        showToast(data.message || `Account created! Welcome, ${name}! ✨`, 'success');
      }
    } else {
      showToast(data.error || 'Registration failed. Try signing in.', 'error');
    }
  } catch (err) {
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

    if (window.pendingCheckoutAction) {
      const pending = window.pendingCheckoutAction;
      window.pendingCheckoutAction = null;
      showToast(`Welcome, ${name}! Continuing with your order...`, 'success');
      setTimeout(() => openCheckoutModal(pending.tab || 'cod'), 200);
    } else {
      showToast(`Welcome, ${name}! ✨`, 'success');
    }
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

      // Check for pending order action
      if (window.pendingCheckoutAction) {
        const pending = window.pendingCheckoutAction;
        window.pendingCheckoutAction = null;
        showToast(`Welcome back, ${data.user.name}! Continuing with your order...`, 'success');
        setTimeout(() => openCheckoutModal(pending.tab || 'cod'), 200);
      } else {
        showToast(data.message || `Welcome back, ${data.user.name}! 👑`, 'success');
      }
    } else {
      showToast(data.error || 'Invalid credentials. Please check and retry.', 'error');
    }
  } catch (err) {
    showToast('Server connection error. Please try again.', 'error');
  }
}

// User Profile Modal
function openProfileModal() {
  const modal = document.getElementById('customer-profile-modal');
  if (!modal) return;

  if (!currentCustomer) {
    openAuthModal('signin');
    return;
  }

  // Update AM Coins & order stats in modal
  const coinsEl = document.getElementById('profile-coins-balance');
  const spentEl = document.getElementById('profile-total-spent');
  const ordersEl = document.getElementById('profile-total-orders');
  if (coinsEl) coinsEl.textContent = currentCustomer.coinBalance || 0;
  if (spentEl) spentEl.textContent = `₹${Number(currentCustomer.totalSpent || 0).toLocaleString('en-IN')}`;
  if (ordersEl) ordersEl.textContent = currentCustomer.totalOrders || 0;

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

  if (headingName) headingName.textContent = currentCustomer.name || 'My Profile';
  if (avatarBadge) {
    const initial = (currentCustomer.name || 'A').charAt(0).toUpperCase();
    avatarBadge.textContent = initial;
  }

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
  showToast('You have signed out.', 'info');
}

// My Orders Modal with Flipkart-Style Live Tracking Timeline
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
    <div class="p-8 text-center text-neutral-500">
      <span class="inline-block animate-spin text-2xl mb-2">⏳</span>
      <p class="text-xs">Fetching your orders from database...</p>
    </div>
  `;

  let orders = [];
  try {
    const identifier = currentCustomer.email || currentCustomer.phone || currentCustomer.userId || '';
    const res = await fetch(`/api/customer/orders/${encodeURIComponent(identifier)}`);
    if (res.ok) {
      orders = await res.json();
    }
  } catch (err) {
    // Fallback to local storage history
    try {
      orders = JSON.parse(localStorage.getItem('AMC_ORDERS_HISTORY') || '[]');
    } catch (e) {
      orders = [];
    }
  }

  if (!Array.isArray(orders) || orders.length === 0) {
    try {
      orders = JSON.parse(localStorage.getItem('AMC_ORDERS_HISTORY') || '[]');
    } catch (e) {}
  }

  if (!Array.isArray(orders) || orders.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-neutral-500 space-y-2">
        <div class="text-4xl">📦</div>
        <p class="text-sm font-bold text-neutral-800">No Orders Placed Yet</p>
        <p class="text-xs text-neutral-500">Discover our Master Copy watches and place your first Cash on Delivery order!</p>
        <button onclick="closeMyOrdersModal(); window.location.href='#catalog';" class="btn-primary mt-4 px-5 py-2 text-xs">
          Explore Collection
        </button>
      </div>
    `;
    return;
  }

  const steps = ['Confirmed', 'Packed', 'Shipped', 'Delivered'];

  container.innerHTML = orders.map(o => {
    const currentStatus = o.status || 'Confirmed';
    const isCancelled = currentStatus.toLowerCase().includes('cancel');
    let activeIdx = steps.findIndex(s => currentStatus.toLowerCase().includes(s.toLowerCase()));
    if (activeIdx === -1) activeIdx = 0;

    return `
      <div class="p-4 rounded-2xl bg-white border border-neutral-200 space-y-3 shadow-xs">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs font-bold text-neutral-900">#${o.orderId}</span>
            <span class="text-[10px] text-neutral-500">• ${new Date(o.createdAt || o.date || Date.now()).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</span>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            isCancelled ? 'bg-red-100 text-red-800' :
            currentStatus.includes('Delivered') ? 'bg-emerald-100 text-emerald-800' :
            currentStatus.includes('Shipped') ? 'bg-blue-100 text-blue-800' :
            'bg-amber-100 text-amber-800'
          }">${currentStatus}</span>
        </div>

        <!-- Flipkart-Style Live Tracking Timeline Bar -->
        ${!isCancelled ? `
          <div class="py-2 px-1">
            <div class="flex items-center justify-between relative">
              <div class="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-neutral-200 w-full z-0"></div>
              <div class="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-600 transition-all duration-500 z-0" style="width: ${(activeIdx / (steps.length - 1)) * 100}%"></div>
              ${steps.map((step, idx) => `
                <div class="flex flex-col items-center z-10">
                  <div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                    idx <= activeIdx
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-neutral-300 text-neutral-400'
                  }">
                    ${idx <= activeIdx ? '✔' : idx + 1}
                  </div>
                  <span class="text-[9px] mt-1 font-semibold ${
                    idx <= activeIdx ? 'text-emerald-700' : 'text-neutral-400'
                  }">${step}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold text-center">
            This order was cancelled.
          </div>
        `}

        <!-- Items in Order -->
        <div class="border-t border-neutral-100 pt-2 space-y-1.5">
          ${(o.items || []).map(it => `
            <div class="flex items-center justify-between text-xs text-neutral-800">
              <div class="flex items-center gap-2">
                <img src="${it.image || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=200'}" class="w-8 h-8 rounded object-contain border border-neutral-100" />
                <span class="font-medium">${it.brand || ''} ${it.model || 'Master Watch'} <span class="text-neutral-400">×${it.quantity || 1}</span></span>
              </div>
              <span class="font-bold text-neutral-900 font-mono">₹${((it.price || 0) * (it.quantity || 1)).toLocaleString('en-IN')}</span>
            </div>
          `).join('')}
        </div>

        <!-- Order Total & Rewards -->
        <div class="border-t border-neutral-100 pt-2 flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
            <span>🪙</span>
            <span>+${o.coinsEarned || Math.floor((o.total || 0) / 100)} AM Coins</span>
          </div>
          <div>
            <span class="text-neutral-500 font-normal">Payable (COD):</span>
            <span class="font-bold text-neutral-900 font-mono text-sm ml-1">₹${Number(o.total || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>

        <!-- WhatsApp Support Link -->
        <div class="pt-1">
          <button onclick="checkoutManager.sendToWhatsApp('Hello AM COLLECTION! I am inquiring about my watch order #${o.orderId}.')" class="w-full py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors">
            <span>💬</span>
            <span>Chat regarding Order #${o.orderId}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function closeMyOrdersModal() {
  const modal = document.getElementById('customer-orders-modal');
  if (modal) modal.classList.add('hidden');
}
