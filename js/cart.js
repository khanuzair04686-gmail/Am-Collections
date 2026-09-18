// AM COLLECTION - Shopping Cart State & UI Drawer Controller

class CartManager {
  constructor() {
    this.storageKey = 'AMC_CART_DATA';
    this.couponKey = 'AMC_COUPON_CODE';
    this.items = this.loadCart();
    this.coupon = this.loadCoupon();
  }

  loadCart() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load cart from storage', e);
      return [];
    }
  }

  saveCart() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items));
      this.dispatchCartUpdate();
    } catch (e) {
      console.error('Failed to save cart to storage', e);
    }
  }

  loadCoupon() {
    try {
      return localStorage.getItem(this.couponKey) || null;
    } catch (e) {
      return null;
    }
  }

  saveCoupon(code) {
    this.coupon = code;
    if (code) {
      localStorage.setItem(this.couponKey, code);
    } else {
      localStorage.removeItem(this.couponKey);
    }
    this.dispatchCartUpdate();
  }

  addItem(product, quantity = 1) {
    const existing = this.items.find(item => item.id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.items.push({
        id: product.id,
        brand: product.brand,
        model: product.model,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        movement: product.movement,
        quantity: quantity
      });
    }
    this.saveCart();
    this.pulseBadge();
    return true;
  }

  removeItem(productId) {
    this.items = this.items.filter(item => item.id !== productId);
    this.saveCart();
  }

  updateQuantity(productId, delta) {
    const item = this.items.find(item => item.id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.removeItem(productId);
    } else {
      this.saveCart();
    }
  }

  clearCart() {
    this.items = [];
    this.saveCart();
  }

  getItems() {
    return this.items;
  }

  getTotalCount() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  getDiscount() {
    const subtotal = this.getSubtotal();
    if (!this.coupon || subtotal === 0) return 0;

    const code = this.coupon.toUpperCase().trim();
    if (code === 'WELCOME500' && subtotal >= 3000) {
      return 500;
    }
    if (code === 'LUXURY10') {
      return Math.round(subtotal * 0.1);
    }
    return 0;
  }

  getTotal() {
    const subtotal = this.getSubtotal();
    const discount = this.getDiscount();
    return Math.max(0, subtotal - discount);
  }

  dispatchCartUpdate() {
    window.dispatchEvent(new CustomEvent('cart:updated', {
      detail: {
        items: this.items,
        count: this.getTotalCount(),
        subtotal: this.getSubtotal(),
        discount: this.getDiscount(),
        total: this.getTotal()
      }
    }));
    this.renderCartUI();
  }

  pulseBadge() {
    const badges = document.querySelectorAll('.cart-count-badge');
    badges.forEach(badge => {
      badge.classList.remove('cart-badge-pulse');
      void badge.offsetWidth; // trigger reflow
      badge.classList.add('cart-badge-pulse');
    });
  }

  renderCartUI() {
    // Update counter badges
    const count = this.getTotalCount();
    const subtotal = this.getSubtotal();
    const discount = this.getDiscount();
    const total = this.getTotal();

    document.querySelectorAll('.cart-count-badge').forEach(el => {
      el.textContent = count;
      if (count > 0) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    // Render Drawer Content
    const drawerContainer = document.getElementById('cart-items-list');
    const emptyContainer = document.getElementById('cart-empty-state');
    const footerContainer = document.getElementById('cart-drawer-footer');
    const subtotalEl = document.getElementById('cart-subtotal-val');
    const discountRow = document.getElementById('cart-discount-row');
    const discountValEl = document.getElementById('cart-discount-val');
    const totalEl = document.getElementById('cart-total-val');

    if (!drawerContainer) return;

    if (this.items.length === 0) {
      drawerContainer.innerHTML = '';
      if (emptyContainer) emptyContainer.classList.remove('hidden');
      if (footerContainer) footerContainer.classList.add('hidden');
      return;
    }

    if (emptyContainer) emptyContainer.classList.add('hidden');
    if (footerContainer) footerContainer.classList.remove('hidden');

    // Populate Items
    drawerContainer.innerHTML = this.items.map(item => `
      <div class="flex items-center gap-3 p-3 bg-white rounded-xl border border-neutral-200 hover:border-neutral-300 shadow-sm transition-all">
        <div class="w-16 h-16 rounded-lg bg-neutral-50 flex-shrink-0 overflow-hidden border border-neutral-200 p-1 flex items-center justify-center">
          <img src="${item.image}" alt="${item.brand} ${item.model}" class="w-full h-full object-contain" onerror="this.src='https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop'" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-neutral-500">${item.brand}</span>
            <button onclick="cartManager.removeItem('${item.id}')" class="text-neutral-400 hover:text-red-500 transition-colors p-1" title="Remove item">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
          <h4 class="text-xs font-semibold text-neutral-900 truncate" title="${item.model}">${item.model}</h4>
          <div class="flex items-center justify-between mt-2">
            <div class="text-neutral-900 font-bold text-sm">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div>
            <div class="flex items-center bg-neutral-100 border border-neutral-200 rounded-md overflow-hidden">
              <button onclick="cartManager.updateQuantity('${item.id}', -1)" class="w-6 h-6 flex items-center justify-center text-neutral-600 hover:bg-neutral-200 transition-colors text-xs font-bold">
                -
              </button>
              <span class="w-6 text-center text-xs font-semibold text-neutral-800">${item.quantity}</span>
              <button onclick="cartManager.updateQuantity('${item.id}', 1)" class="w-6 h-6 flex items-center justify-center text-neutral-600 hover:bg-neutral-200 transition-colors text-xs font-bold">
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    // Update totals
    if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
    
    if (discountRow && discountValEl) {
      if (discount > 0) {
        discountRow.classList.remove('hidden');
        discountValEl.textContent = `-₹${discount.toLocaleString('en-IN')}`;
      } else {
        discountRow.classList.add('hidden');
      }
    }

    if (totalEl) totalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
  }
}

// Global Cart Instance
const cartManager = new CartManager();
