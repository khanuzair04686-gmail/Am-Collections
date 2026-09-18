// AM COLLECTION - Cash on Delivery (COD) & WhatsApp Checkout System

class CheckoutManager {
  constructor() {
    this.defaultPhone = '919876543210'; // 91 + 10 digits
    this.storagePhoneKey = 'AMC_STORE_PHONE';
    this.ordersKey = 'AMC_ORDERS_HISTORY';
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

  // Generate WhatsApp text for cart
  buildCartWhatsAppMessage(orderDetails = null) {
    const items = cartManager.getItems();
    if (items.length === 0 && !orderDetails?.directItem) return null;

    const orderId = orderDetails?.orderId || this.generateOrderId();
    const currentDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let message = `🌟 *NEW MASTER WATCH ORDER - AM COLLECTION* 🌟\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🧾 *Order ID:* #${orderId}\n`;
    message += `📅 *Date:* ${currentDate}\n\n`;
    message += `🛒 *ORDERED TIMEPIECES:*\n`;

    const itemList = orderDetails?.directItem ? [orderDetails.directItem] : items;
    let calculatedTotal = 0;

    itemList.forEach((item, index) => {
      const lineTotal = item.price * (item.quantity || 1);
      calculatedTotal += lineTotal;
      message += `${index + 1}. *${item.brand} ${item.model}*\n`;
      message += `   • Movement: ${item.movement || '1:1 Master Automatic/Quartz'}\n`;
      message += `   • Qty: ${item.quantity || 1} × ₹${item.price.toLocaleString('en-IN')} = *₹${lineTotal.toLocaleString('en-IN')}*\n\n`;
    });

    const discount = orderDetails?.discount || cartManager.getDiscount();
    const finalTotal = orderDetails?.total || (calculatedTotal - discount);

    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💵 *Subtotal:* ₹${calculatedTotal.toLocaleString('en-IN')}\n`;
    if (discount > 0) {
      message += `🎟️ *Special Discount:* -₹${discount.toLocaleString('en-IN')}\n`;
    }
    message += `💰 *FINAL AMOUNT PAYABLE:* *₹${finalTotal.toLocaleString('en-IN')}*\n`;
    message += `📦 *PAYMENT MODE:* Cash on Delivery (COD)\n`;
    message += `🚚 *SHIPPING:* FREE Pan-India Express Delivery\n\n`;

    if (orderDetails?.customer) {
      const c = orderDetails.customer;
      message += `👤 *CUSTOMER DELIVERY DETAILS:*\n`;
      message += `• *Full Name:* ${c.fullName}\n`;
      message += `• *Phone Number:* ${c.phone}\n`;
      if (c.altPhone) message += `• *Alt WhatsApp:* ${c.altPhone}\n`;
      message += `• *Delivery Address:* ${c.address}\n`;
      if (c.landmark) message += `• *Landmark:* ${c.landmark}\n`;
      message += `• *City & State:* ${c.city}, ${c.state}\n`;
      message += `• *Pincode:* ${c.pincode}\n`;
      if (c.notes) message += `• *Special Instructions:* ${c.notes}\n`;
    } else {
      message += `📝 *CUSTOMER DELIVERY DETAILS:*\n`;
      message += `(Please reply to this message with your Name, Full Address and Pincode to dispatch your COD order!)\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `✨ *AM COLLECTION* • Timeless Elegance - Master Copy Watches`;

    return message;
  }

  // Open WhatsApp directly
  sendToWhatsApp(message) {
    const storePhone = this.getStorePhone();
    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${storePhone}?text=${encoded}`;
    window.open(waUrl, '_blank');
  }

  // Quick Direct WhatsApp Buy for single product
  quickBuyWhatsApp(product) {
    const message = this.buildCartWhatsAppMessage({
      directItem: {
        brand: product.brand,
        model: product.model,
        price: product.price,
        quantity: 1,
        movement: product.movement
      },
      total: product.price,
      discount: 0
    });
    this.sendToWhatsApp(message);
  }

  // Submit Cash on Delivery Order
  processCodOrder(formData) {
    const items = [...cartManager.getItems()];
    if (items.length === 0) {
      alert('Your cart is empty!');
      return false;
    }

    const orderId = this.generateOrderId();
    const total = cartManager.getTotal();
    const discount = cartManager.getDiscount();
    const subtotal = cartManager.getSubtotal();

    const orderRecord = {
      orderId,
      date: new Date().toISOString(),
      displayDate: new Date().toLocaleString('en-IN'),
      customer: formData,
      customerName: formData.fullName || (typeof currentCustomer !== 'undefined' && currentCustomer ? currentCustomer.name : 'Valued Patron'),
      customerEmail: formData.customerEmail || (typeof currentCustomer !== 'undefined' && currentCustomer ? currentCustomer.email : ''),
      phone: formData.phone || '',
      items,
      subtotal,
      discount,
      total,
      status: 'Confirmed - COD Dispatched'
    };

    // Save to order history
    try {
      const history = JSON.parse(localStorage.getItem(this.ordersKey) || '[]');
      history.unshift(orderRecord);
      localStorage.setItem(this.ordersKey, JSON.stringify(history));

      // Sync with Express / MongoDB Backend if server is active
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderRecord)
      }).catch(() => {});
    } catch (e) {
      console.error('Error saving order history', e);
    }

    // Prepare WhatsApp text for confirmation
    const waMessage = this.buildCartWhatsAppMessage({
      orderId,
      customer: formData,
      items,
      total,
      discount
    });

    // Clear cart
    cartManager.clearCart();

    // Show Confirmation modal
    this.showConfirmationModal(orderRecord, waMessage);
    return true;
  }

  showConfirmationModal(order, waMessage) {
    const modal = document.getElementById('order-success-modal');
    if (!modal) return;

    // Fill details
    const orderIdEl = document.getElementById('success-order-id');
    const orderTotalEl = document.getElementById('success-order-total');
    const customerNameEl = document.getElementById('success-customer-name');
    const customerAddressEl = document.getElementById('success-customer-address');
    const itemsListEl = document.getElementById('success-items-list');
    const waBtn = document.getElementById('success-wa-send-btn');

    if (orderIdEl) orderIdEl.textContent = `#${order.orderId}`;
    if (orderTotalEl) orderTotalEl.textContent = `₹${order.total.toLocaleString('en-IN')}`;
    if (customerNameEl) customerNameEl.textContent = order.customer.fullName;
    if (customerAddressEl) {
      customerAddressEl.textContent = `${order.customer.address}, ${order.customer.city}, ${order.customer.state} - ${order.customer.pincode}`;
    }

    if (itemsListEl) {
      itemsListEl.innerHTML = order.items.map(i => `
        <div class="flex justify-between items-center text-xs py-1.5 border-b border-neutral-800 text-neutral-300">
          <span>${i.brand} ${i.model} (×${i.quantity})</span>
          <span class="font-semibold text-amber-400">₹${(i.price * i.quantity).toLocaleString('en-IN')}</span>
        </div>
      `).join('');
    }

    if (waBtn) {
      waBtn.onclick = () => {
        this.sendToWhatsApp(waMessage);
      };
    }

    // Close checkout modal if open
    const checkoutModal = document.getElementById('checkout-modal');
    if (checkoutModal) checkoutModal.classList.add('hidden');

    // Close cart drawer if open
    if (typeof closeCartDrawer === 'function') {
      closeCartDrawer();
    }

    // Open Success Modal
    modal.classList.remove('hidden');
  }
}

// Global Checkout Instance
const checkoutManager = new CheckoutManager();
