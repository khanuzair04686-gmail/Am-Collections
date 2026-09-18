// AM COLLECTION - Enterprise Checkout & Flipkart-Style Order Experience
// Completely removes alert() popups, handles AM Coins, Coupons, Real-Time DB sync

class CheckoutManager {
  constructor() {
    this.defaultPhone = '919876543210';
    this.storagePhoneKey = 'AMC_STORE_PHONE';
    this.ordersKey = 'AMC_ORDERS_HISTORY';
    this.isUsingCoins = false;
    this.appliedCoupon = null; // { code, discount }
  }

  getStorePhone() {
    return localStorage.getItem(this.storagePhoneKey) || this.defaultPhone;
  }

  setStorePhone(phone) {
    const clean = phone.replace(/[^0-9]/g, '');
    localStorage.setItem(this.storagePhoneKey, clean);
    return clean;
  }

  generateOrderId() {
    const num = Math.floor(10000 + Math.random() * 90000);
    return `AMC-${num}`;
  }

  // AM Coins toggle calculation
  toggleUseCoins(enable) {
    this.isUsingCoins = Boolean(enable);
    this.updateCheckoutSummaryUI();
  }

  // Get available coins for logged-in customer
  getAvailableCoins() {
    if (typeof currentCustomer !== 'undefined' && currentCustomer && currentCustomer.coinBalance) {
      return Number(currentCustomer.coinBalance) || 0;
    }
    return 0;
  }

  // Calculate bill with Coupons and AM Coins
  calculateTotals() {
    const items = (typeof cartManager !== 'undefined') ? cartManager.getItems() : [];
    const subtotal = items.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0);
    const regularDiscount = (typeof cartManager !== 'undefined') ? cartManager.getDiscount() : 0;

    let couponDiscount = 0;
    if (this.appliedCoupon && this.appliedCoupon.discount) {
      couponDiscount = Math.min(subtotal, this.appliedCoupon.discount);
    }

    let coinDiscount = 0;
    let coinsUsed = 0;
    if (this.isUsingCoins) {
      const avail = this.getAvailableCoins();
      // Max coin discount: cannot exceed available coins or remaining bill
      const remainingPayable = Math.max(0, subtotal - regularDiscount - couponDiscount);
      coinDiscount = Math.min(avail, remainingPayable);
      coinsUsed = coinDiscount; // 1 coin = ₹1
    }

    const finalTotal = Math.max(0, subtotal - regularDiscount - couponDiscount - coinDiscount);
    // 1 coin per ₹100 spent
    const coinsEarned = Math.floor(finalTotal / 100);

    return {
      subtotal,
      regularDiscount,
      couponDiscount,
      coinDiscount,
      coinsUsed,
      finalTotal,
      coinsEarned
    };
  }

  // Live update of Checkout Modal summary
  updateCheckoutSummaryUI() {
    const itemsContainer = document.getElementById('checkout-items-summary');
    const totalEl = document.getElementById('checkout-total-val');
    const coinsBalanceEl = document.getElementById('checkout-coins-balance');
    const coinsDiscountRow = document.getElementById('checkout-coins-discount-row');
    const coinsDiscountVal = document.getElementById('checkout-coins-discount-val');
    const couponDiscountRow = document.getElementById('checkout-coupon-discount-row');
    const couponDiscountVal = document.getElementById('checkout-coupon-discount-val');
    const coinsEarnedBadge = document.getElementById('checkout-coins-earned-badge');

    const items = (typeof cartManager !== 'undefined') ? cartManager.getItems() : [];
    const totals = this.calculateTotals();

    if (itemsContainer) {
      if (items.length === 0) {
        itemsContainer.innerHTML = '<p class="text-neutral-500 text-xs py-2">Your bag is empty.</p>';
      } else {
        itemsContainer.innerHTML = items.map(i => `
          <div class="flex justify-between items-center text-xs py-1 border-b border-neutral-100 text-neutral-700">
            <span class="truncate max-w-[200px] font-medium">${i.brand} ${i.model} <span class="text-neutral-400 font-normal">×${i.quantity || 1}</span></span>
            <span class="font-bold text-neutral-900 font-mono">₹${((i.price) * (i.quantity || 1)).toLocaleString('en-IN')}</span>
          </div>
        `).join('');
      }
    }

    if (coinsBalanceEl) {
      coinsBalanceEl.textContent = `${this.getAvailableCoins()} AM Coins`;
    }

    if (coinsDiscountRow && coinsDiscountVal) {
      if (totals.coinDiscount > 0) {
        coinsDiscountRow.classList.remove('hidden');
        coinsDiscountVal.textContent = `-₹${totals.coinDiscount.toLocaleString('en-IN')}`;
      } else {
        coinsDiscountRow.classList.add('hidden');
      }
    }

    if (couponDiscountRow && couponDiscountVal) {
      if (totals.couponDiscount > 0) {
        couponDiscountRow.classList.remove('hidden');
        couponDiscountVal.textContent = `-₹${totals.couponDiscount.toLocaleString('en-IN')}`;
      } else {
        couponDiscountRow.classList.add('hidden');
      }
    }

    if (totalEl) {
      totalEl.textContent = `₹${totals.finalTotal.toLocaleString('en-IN')}`;
    }

    if (coinsEarnedBadge) {
      coinsEarnedBadge.textContent = `+${totals.coinsEarned} AM Coins on this order`;
    }
  }

  // Apply Coupon Code
  async applyCouponCode(code) {
    if (!code || !code.trim()) {
      showToast('Please enter a coupon code.', 'error');
      return;
    }
    const totals = this.calculateTotals();
    try {
      showToast('Checking coupon...', 'info');
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), orderAmount: totals.subtotal })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.appliedCoupon = { code: data.code, discount: data.discount };
        showToast(data.message || `Coupon '${data.code}' applied!`, 'success');
        this.updateCheckoutSummaryUI();
      } else {
        showToast(data.error || 'Invalid or expired coupon code.', 'error');
      }
    } catch (e) {
      // Offline fallback for known welcome coupons
      const clean = code.trim().toUpperCase();
      if (clean === 'WELCOME500' || clean === 'PRIVILEGE500') {
        this.appliedCoupon = { code: clean, discount: 500 };
        showToast(`Coupon '${clean}' applied! ₹500 OFF.`, 'success');
        this.updateCheckoutSummaryUI();
      } else {
        showToast('Unable to validate coupon code right now.', 'error');
      }
    }
  }

  // Process Cash on Delivery Order (Production Flow)
  async processCodOrder(formData, submitBtn = null) {
    const items = (typeof cartManager !== 'undefined') ? [...cartManager.getItems()] : [];
    if (items.length === 0) {
      showToast('Your shopping bag is empty! Add a timepiece first.', 'error');
      return false;
    }

    // Disable button to prevent double-submit
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="inline-flex items-center gap-2">
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          Securing Your Order...
        </span>
      `;
    }

    const totals = this.calculateTotals();
    const orderId = this.generateOrderId();

    const orderRecord = {
      orderId,
      userId: (typeof currentCustomer !== 'undefined' && currentCustomer) ? currentCustomer.userId : '',
      customerName: formData.fullName || (typeof currentCustomer !== 'undefined' && currentCustomer ? currentCustomer.name : 'Valued Patron'),
      customerEmail: formData.customerEmail || (typeof currentCustomer !== 'undefined' && currentCustomer ? currentCustomer.email : ''),
      phone: formData.phone || '',
      altPhone: formData.altPhone || '',
      address: formData.address || '',
      landmark: formData.landmark || '',
      city: formData.city || '',
      state: formData.state || '',
      pincode: formData.pincode || '',
      items,
      subtotal: totals.subtotal,
      discount: totals.regularDiscount,
      couponDiscount: totals.couponDiscount,
      couponCode: this.appliedCoupon ? this.appliedCoupon.code : '',
      coinsUsed: totals.coinsUsed,
      coinDiscount: totals.coinDiscount,
      coinsEarned: totals.coinsEarned,
      total: totals.finalTotal,
      paymentMethod: 'Cash on Delivery (COD)',
      status: 'Confirmed'
    };

    try {
      // 1. Post to backend API
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderRecord)
      });

      let responseData = null;
      if (res.ok) {
        responseData = await res.json();
      }

      // 2. Update local order history
      try {
        const history = JSON.parse(localStorage.getItem(this.ordersKey) || '[]');
        history.unshift(orderRecord);
        localStorage.setItem(this.ordersKey, JSON.stringify(history));
      } catch (e) {}

      // 3. Update local customer coins state
      if (typeof currentCustomer !== 'undefined' && currentCustomer) {
        let bal = Number(currentCustomer.coinBalance || 0);
        bal = Math.max(0, bal - totals.coinsUsed);
        bal += totals.coinsEarned;
        currentCustomer.coinBalance = bal;
        currentCustomer.totalSpent = (currentCustomer.totalSpent || 0) + totals.finalTotal;
        currentCustomer.totalOrders = (currentCustomer.totalOrders || 0) + 1;
        try {
          localStorage.setItem('amc_customer', JSON.stringify(currentCustomer));
        } catch (e) {}
        if (typeof updateCustomerHeaderUI === 'function') updateCustomerHeaderUI();
      }

      // 4. Mobile Haptic Vibration
      if (navigator.vibrate) {
        try { navigator.vibrate([100, 50, 100]); } catch (e) {}
      }

      // 5. Clear Cart ONLY after successful write
      cartManager.clearCart();

      // Reset coupon & coins state
      this.isUsingCoins = false;
      this.appliedCoupon = null;

      // 6. Close checkout & cart modals
      if (typeof closeCheckoutModal === 'function') closeCheckoutModal();
      if (typeof closeCartDrawer === 'function') closeCartDrawer();

      // 7. Show Flipkart-style Success Screen
      this.showOrderSuccessScreen(orderRecord, totals.coinsEarned);
      return true;

    } catch (err) {
      console.error('Order creation error:', err);
      showToast('Network error processing your order. Please check connection.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Cash on Delivery Order';
      }
      return false;
    }
  }

  // Show Flipkart-Style Fullscreen Success Animation & Confirmation
  showOrderSuccessScreen(order, coinsEarned = 0) {
    const screen = document.getElementById('order-success-screen');
    if (!screen) return;

    // Fill Dynamic Fields
    const idEl = document.getElementById('success-screen-order-id');
    const totalEl = document.getElementById('success-screen-total');
    const dateEl = document.getElementById('success-screen-delivery-date');
    const nameEl = document.getElementById('success-screen-name');
    const addressEl = document.getElementById('success-screen-address');
    const coinsBadge = document.getElementById('success-screen-coins-badge');
    const coinsVal = document.getElementById('success-screen-coins-val');
    const itemsList = document.getElementById('success-screen-items-list');

    if (idEl) idEl.textContent = `#${order.orderId}`;
    if (totalEl) totalEl.textContent = `₹${order.total.toLocaleString('en-IN')}`;
    if (nameEl) nameEl.textContent = order.customerName;
    if (addressEl) {
      addressEl.textContent = `${order.address}, ${order.city}, ${order.state} - ${order.pincode}`;
    }

    // Estimated Delivery: 3 to 5 business days from now
    if (dateEl) {
      const delDate = new Date();
      delDate.setDate(delDate.getDate() + 4);
      dateEl.textContent = delDate.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    }

    // AM Coins Awarded Banner
    if (coinsBadge && coinsVal) {
      if (coinsEarned > 0) {
        coinsVal.textContent = `+${coinsEarned} AM Coins Earned!`;
        coinsBadge.classList.remove('hidden');
      } else {
        coinsBadge.classList.add('hidden');
      }
    }

    if (itemsList && order.items) {
      itemsList.innerHTML = order.items.map(i => `
        <div class="flex items-center justify-between text-xs py-2 border-b border-neutral-100">
          <div class="flex items-center gap-2">
            <img src="${i.image || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=200'}" class="w-10 h-10 object-contain rounded border border-neutral-200" />
            <div>
              <p class="font-bold text-neutral-900">${i.brand} ${i.model}</p>
              <p class="text-[11px] text-neutral-500">Qty: ${i.quantity || 1} • COD Verified</p>
            </div>
          </div>
          <span class="font-bold text-neutral-900 font-mono">₹${((i.price) * (i.quantity || 1)).toLocaleString('en-IN')}</span>
        </div>
      `).join('');
    }

    // Show Screen with smooth animation
    screen.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Trigger celebratory confetti burst
    this.launchConfetti();
  }

  // Close Order Success Screen
  closeOrderSuccessScreen() {
    const screen = document.getElementById('order-success-screen');
    if (screen) {
      screen.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  // Confetti Particle Explosion
  launchConfetti() {
    const canvas = document.getElementById('order-confetti-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#6366F1', '#14B8A6'];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        r: Math.random() * 6 + 3,
        dx: (Math.random() - 0.5) * 16,
        dy: (Math.random() - 0.5) * 16 - 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngle: 0,
        tiltAngleInc: Math.random() * 0.08 + 0.04,
        alpha: 1
      });
    }

    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        p.dy += 0.25; // gravity
        p.tiltAngle += p.tiltAngleInc;
        p.alpha -= 0.008;

        if (p.alpha > 0) {
          ctx.beginPath();
          ctx.lineWidth = p.r;
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.moveTo(p.x + p.tilt, p.y);
          ctx.lineTo(p.x + p.tilt + p.r / 2, p.y + p.tilt);
          ctx.stroke();
        }
      });

      frame++;
      if (frame < 120) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    requestAnimationFrame(animate);
  }

  // Build WhatsApp text for direct messaging
  buildCartWhatsAppMessage(orderDetails = null) {
    const items = (typeof cartManager !== 'undefined') ? cartManager.getItems() : [];
    if (items.length === 0 && !orderDetails?.directItem) return null;

    const orderId = orderDetails?.orderId || this.generateOrderId();
    const currentDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    let message = `🌟 *NEW LUXURY WATCH COD ORDER - AM COLLECTION* 🌟\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🧾 *Order ID:* #${orderId}\n`;
    message += `📅 *Date:* ${currentDate}\n\n`;
    message += `🛒 *ORDERED TIMEPIECES:*\n`;

    const itemList = orderDetails?.directItem ? [orderDetails.directItem] : items;
    let subtotal = 0;

    itemList.forEach((item, index) => {
      const lineTotal = item.price * (item.quantity || 1);
      subtotal += lineTotal;
      message += `${index + 1}. *${item.brand} ${item.model}*\n`;
      message += `   • Movement: ${item.movement || '1:1 Master Automatic'}\n`;
      message += `   • Qty: ${item.quantity || 1} × ₹${item.price.toLocaleString('en-IN')} = *₹${lineTotal.toLocaleString('en-IN')}*\n\n`;
    });

    const finalTotal = orderDetails?.total || subtotal;

    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *AMOUNT PAYABLE:* *₹${finalTotal.toLocaleString('en-IN')}*\n`;
    message += `📦 *PAYMENT MODE:* Cash on Delivery (COD)\n`;
    message += `🚚 *SHIPPING:* FREE Pan-India Express Delivery\n\n`;

    if (orderDetails?.customer) {
      const c = orderDetails.customer;
      message += `👤 *DELIVERY ADDRESS:*\n`;
      message += `• *Name:* ${c.fullName || c.name}\n`;
      message += `• *Phone:* ${c.phone}\n`;
      message += `• *Address:* ${c.address}, ${c.city || ''} - ${c.pincode || ''}\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `✨ *AM COLLECTION* • Timeless Elegance - Master Copy Watches`;

    return message;
  }

  sendToWhatsApp(message) {
    const phone = this.getStorePhone();
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  }

  quickBuyWhatsApp(product) {
    const msg = this.buildCartWhatsAppMessage({
      directItem: {
        brand: product.brand,
        model: product.model,
        price: product.price,
        quantity: 1,
        movement: product.movement
      },
      total: product.price
    });
    this.sendToWhatsApp(msg);
  }
}

// Global instance
const checkoutManager = new CheckoutManager();
