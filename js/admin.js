// AM COLLECTION - Enterprise Admin Management Portal Controller
// Full MongoDB Atlas synchronization + Permanent CRUD + Customers + Coupons + Orders

let adminWatches = [];
let adminOrders = [];
let adminUsers = [];
let adminCoupons = [];
let currentEditingId = null;

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupAdminListeners();
});

// Authentication Check
function checkAuth() {
  const isAuth = sessionStorage.getItem('amc_admin_auth');
  const modal = document.getElementById('auth-modal');
  if (isAuth === 'true') {
    if (modal) modal.classList.add('hidden');
    loadDashboardData();
  } else {
    if (modal) modal.classList.remove('hidden');
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const passkey = document.getElementById('auth-passkey').value.trim();
  if (!passkey) return;

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey })
    });

    if (res.ok) {
      sessionStorage.setItem('amc_admin_auth', 'true');
      const modal = document.getElementById('auth-modal');
      if (modal) modal.classList.add('hidden');
      showToast('Admin Access Granted! Welcome to AM COLLECTION Portal. 👑', 'success');
      loadDashboardData();
    } else {
      showToast('Incorrect Admin Passkey! Please check and retry.', 'error');
    }
  } catch (err) {
    if (passkey === 'admin123') {
      sessionStorage.setItem('amc_admin_auth', 'true');
      const modal = document.getElementById('auth-modal');
      if (modal) modal.classList.add('hidden');
      showToast('Admin Access Granted (Offline Mode)!', 'info');
      loadDashboardData();
    } else {
      showToast('Incorrect Admin Passkey!', 'error');
    }
  }
}

function handleLogout() {
  sessionStorage.removeItem('amc_admin_auth');
  location.reload();
}

// Setup Event Listeners
function setupAdminListeners() {
  const authForm = document.getElementById('auth-form');
  if (authForm) authForm.addEventListener('submit', handleAuthSubmit);

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  const passkeyForm = document.getElementById('change-passkey-form');
  if (passkeyForm) passkeyForm.addEventListener('submit', handleChangePasskey);

  const logoForm = document.getElementById('logo-upload-form');
  if (logoForm) logoForm.addEventListener('submit', handleLogoUpload);

  const settingsForm = document.getElementById('settings-text-form');
  if (settingsForm) settingsForm.addEventListener('submit', handleSettingsSubmit);

  const watchForm = document.getElementById('watch-form');
  if (watchForm) watchForm.addEventListener('submit', handleWatchFormSubmit);

  const couponForm = document.getElementById('create-coupon-form');
  if (couponForm) couponForm.addEventListener('submit', handleCreateCoupon);

  const searchInput = document.getElementById('admin-search-watches');
  if (searchInput) searchInput.addEventListener('input', () => renderWatchesTable());

  const filterBrand = document.getElementById('admin-filter-brand');
  if (filterBrand) filterBrand.addEventListener('change', () => renderWatchesTable());

  const searchOrders = document.getElementById('admin-search-orders');
  if (searchOrders) searchOrders.addEventListener('input', () => renderOrdersTable());

  const filterOrderStatus = document.getElementById('admin-filter-order-status');
  if (filterOrderStatus) filterOrderStatus.addEventListener('change', () => renderOrdersTable());
}

// Load All Dashboard Data
async function loadDashboardData() {
  await Promise.allSettled([
    checkSystemHealth(),
    loadAdminSettings(),
    loadAdminWatches(),
    loadAdminOrders(),
    loadAdminUsers(),
    loadAdminCoupons()
  ]);
}

// 1. Health Status & Stats
async function checkSystemHealth() {
  const pill = document.getElementById('db-status-pill');
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      if (pill) pill.textContent = data.database;
    }
  } catch (e) {
    if (pill) pill.textContent = 'Local Mode';
  }
}

// 2. Settings & Branding
async function loadAdminSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const settings = await res.json();

    const nameInput = document.getElementById('setting-store-name');
    const taglineInput = document.getElementById('setting-tagline');
    const phoneInput = document.getElementById('setting-store-phone');
    const annInput = document.getElementById('setting-announcement');

    if (nameInput) nameInput.value = settings.storeName || 'AM COLLECTION';
    if (taglineInput) taglineInput.value = settings.tagline || 'Timeless Elegance - Master Copy Watches';
    if (phoneInput) phoneInput.value = settings.storePhone || '919876543210';
    if (annInput) annInput.value = settings.announcementText || '';

    // Preview Logo
    const preview = document.getElementById('branding-logo-preview');
    const placeholder = document.getElementById('branding-logo-placeholder');
    if (settings.logoUrl) {
      preview.src = settings.logoUrl;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
    } else {
      preview.classList.add('hidden');
      placeholder.classList.remove('hidden');
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
}

async function handleSettingsSubmit(e) {
  e.preventDefault();
  const storeName = document.getElementById('setting-store-name').value.trim();
  const storePhone = document.getElementById('setting-store-phone').value.trim();
  const tagline = document.getElementById('setting-tagline').value.trim();
  const announcementText = document.getElementById('setting-announcement').value.trim();

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeName, storePhone, tagline, announcementText })
    });

    if (res.ok) {
      showToast('Store settings saved successfully! 💎', 'success');
    } else {
      showToast('Failed to update settings', 'error');
    }
  } catch (e) {
    showToast('Network error saving settings', 'error');
  }
}

async function handleLogoUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('logo-file-input');
  if (!fileInput || !fileInput.files[0]) {
    showToast('Please select an image file to upload as logo!', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('logo', fileInput.files[0]);

  try {
    showToast('Uploading new logo...', 'info');
    const res = await fetch('/api/settings/logo', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      const preview = document.getElementById('branding-logo-preview');
      const placeholder = document.getElementById('branding-logo-placeholder');
      preview.src = data.logoUrl;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
      fileInput.value = '';
      showToast('Logo updated successfully! ✨', 'success');
    } else {
      showToast('Failed to upload logo image', 'error');
    }
  } catch (e) {
    showToast('Upload error', 'error');
  }
}

async function handleRemoveLogo() {
  if (!confirm('Permanently remove custom logo and return to default monogram?')) return;
  try {
    const res = await fetch('/api/settings/logo', { method: 'DELETE' });
    if (res.ok) {
      const preview = document.getElementById('branding-logo-preview');
      const placeholder = document.getElementById('branding-logo-placeholder');
      preview.src = '';
      preview.classList.add('hidden');
      placeholder.classList.remove('hidden');
      showToast('Logo removed permanently.', 'success');
    }
  } catch (e) {
    showToast('Error removing logo', 'error');
  }
}

async function handleChangePasskey(e) {
  e.preventDefault();
  const currentPasskey = document.getElementById('passkey-current').value.trim();
  const newPasskey = document.getElementById('passkey-new').value.trim();
  const confirmPasskey = document.getElementById('passkey-confirm').value.trim();

  if (newPasskey !== confirmPasskey) {
    showToast('New passkeys do not match! Please check.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/change-passkey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPasskey, newPasskey })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Passkey updated! 🔒', 'success');
      document.getElementById('change-passkey-form').reset();
    } else {
      showToast(data.error || 'Failed to update passkey.', 'error');
    }
  } catch (e) {
    showToast('Error updating passkey', 'error');
  }
}

// 3. Watches Management (PERMANENT CRUD)
async function loadAdminWatches() {
  try {
    const res = await fetch('/api/products?includeHidden=true');
    if (!res.ok) return;
    adminWatches = await res.json();

    const statCount = document.getElementById('stat-total-watches');
    if (statCount) statCount.textContent = adminWatches.length;

    renderWatchesTable();
  } catch (e) {
    console.error('Failed to load watches', e);
  }
}

function renderWatchesTable() {
  const tbody = document.getElementById('admin-watches-table-body');
  if (!tbody) return;

  const query = (document.getElementById('admin-search-watches')?.value || '').toLowerCase().trim();
  const brand = document.getElementById('admin-filter-brand')?.value || 'all';

  const filtered = adminWatches.filter(w => {
    const matchesBrand = brand === 'all' || w.category === brand || (w.brand && w.brand.toLowerCase() === brand.toLowerCase());
    const matchesQuery = !query || 
      (w.brand && w.brand.toLowerCase().includes(query)) || 
      (w.model && w.model.toLowerCase().includes(query)) || 
      (w.movement && w.movement.toLowerCase().includes(query));
    return matchesBrand && matchesQuery;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-neutral-500">
          No watches matching current filter. Click "+ Upload New Watch" above to add one!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(w => `
    <tr class="hover:bg-neutral-900/40 transition-colors">
      <td class="p-4">
        <div class="flex items-center gap-3">
          <img src="${w.image}" alt="${w.model}" class="w-12 h-12 rounded-xl object-contain border border-neutral-800 bg-black flex-shrink-0" onerror="this.src='https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop'" />
          <div>
            <div class="flex items-center gap-1.5 font-bold text-white text-xs">
              ${w.model}
              ${w.isBestSeller ? '<span class="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1">BEST SELLER</span>' : ''}
              ${w.isNewArrival ? '<span class="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded px-1">NEW</span>' : ''}
            </div>
            <div class="text-[10px] text-neutral-400 truncate max-w-xs">${w.tagline || ''}</div>
          </div>
        </div>
      </td>
      <td class="p-4 font-semibold text-amber-400">${w.brand}</td>
      <td class="p-4 font-bold text-white font-mono">₹${Number(w.price).toLocaleString('en-IN')}</td>
      <td class="p-4 font-mono ${(w.stock || 0) <= 5 ? 'text-red-400 font-bold' : 'text-neutral-300'}">${w.stock !== undefined ? w.stock : 20}</td>
      <td class="p-4 text-neutral-300">${w.movement || 'Japanese Automatic'}</td>
      <td class="p-4">
        <span class="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[10px] font-bold">
          ${w.badge || '1:1 MASTER'}
        </span>
      </td>
      <td class="p-4">
        <button onclick="toggleWatchHidden('${w.id}')" class="px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
          w.isHidden ? 'bg-red-950/60 text-red-300 border-red-500/30' : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
        }">
          ${w.isHidden ? 'Hidden 👁️' : 'Live ✔'}
        </button>
      </td>
      <td class="p-4 text-right">
        <div class="flex items-center justify-end gap-2">
          <button onclick="openEditWatchModal('${w.id}')" class="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-amber-300 transition-colors" title="Edit Watch Details">
            Edit
          </button>
          <button onclick="handleDeleteWatchPermanently('${w.id}', '${w.brand} ${w.model}')" class="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-500/30 transition-colors" title="Permanently Delete">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Permanently Delete Watch
async function handleDeleteWatchPermanently(id, title) {
  if (!confirm(`Are you sure you want to PERMANENTLY remove "${title}" from the database?\nThis watch will NEVER come back after refresh or redeploy.`)) {
    return;
  }

  try {
    showToast('Deleting watch permanently...', 'info');
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`"${title}" permanently removed from database! 🗑️`, 'success');
      await loadAdminWatches();
    } else {
      showToast('Failed to delete watch', 'error');
    }
  } catch (e) {
    showToast('Error deleting watch', 'error');
  }
}

// Toggle Hidden
async function toggleWatchHidden(id) {
  try {
    const res = await fetch(`/api/products/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'isHidden' })
    });
    if (res.ok) {
      await loadAdminWatches();
    }
  } catch (e) {}
}

// Manual Seed catalog button
async function handleSeedCatalog() {
  if (!confirm('Populate the default curated 8 master copy watches into the catalog?')) return;
  try {
    showToast('Populating watches...', 'info');
    const res = await fetch('/api/admin/seed-defaults', { method: 'POST' });
    if (res.ok) {
      showToast('Curated collection populated! 🌟', 'success');
      await loadAdminWatches();
    }
  } catch (e) {
    showToast('Error populating catalog', 'error');
  }
}

// Add / Edit Watch Modal Handling
function openAddWatchModal() {
  currentEditingId = null;
  document.getElementById('watch-modal-title').textContent = 'UPLOAD NEW MASTER WATCH';
  document.getElementById('watch-form').reset();
  document.getElementById('form-watch-id').value = '';
  document.getElementById('form-watch-image-preview').classList.add('hidden');
  document.getElementById('video-preview-container').classList.add('hidden');
  document.getElementById('watch-modal').classList.remove('hidden');
}

function openEditWatchModal(id) {
  const watch = adminWatches.find(w => w.id === id);
  if (!watch) return;

  currentEditingId = id;
  document.getElementById('watch-modal-title').textContent = `EDIT ${watch.brand} ${watch.model}`;

  document.getElementById('form-watch-id').value = watch.id;
  document.getElementById('form-watch-brand').value = watch.brand || '';
  document.getElementById('form-watch-category').value = watch.category || 'other';
  document.getElementById('form-watch-model').value = watch.model || '';
  document.getElementById('form-watch-tagline').value = watch.tagline || '';
  document.getElementById('form-watch-price').value = watch.price || '';
  document.getElementById('form-watch-original-price').value = watch.originalPrice || '';
  document.getElementById('form-watch-badge').value = watch.badge || '1:1 MASTER';
  document.getElementById('form-watch-movement').value = watch.movement || '';
  document.getElementById('form-watch-dial').value = watch.dialSize || '';
  document.getElementById('form-watch-glass').value = watch.glass || '';
  document.getElementById('form-watch-strap').value = watch.strap || '';
  document.getElementById('form-watch-stock').value = watch.stock !== undefined ? watch.stock : 20;
  document.getElementById('form-watch-bestseller').checked = Boolean(watch.isBestSeller);
  document.getElementById('form-watch-newarrival').checked = Boolean(watch.isNewArrival);
  document.getElementById('form-watch-trending').checked = Boolean(watch.isTrending);
  document.getElementById('form-watch-image-url').value = watch.image || '';
  document.getElementById('form-watch-desc').value = watch.description || '';
  document.getElementById('form-watch-features').value = Array.isArray(watch.features) ? watch.features.join('\n') : (watch.features || '');

  document.getElementById('form-watch-image-preview').classList.add('hidden');
  document.getElementById('video-preview-container').classList.add('hidden');
  document.getElementById('watch-modal').classList.remove('hidden');
}

function closeWatchModal() {
  document.getElementById('watch-modal').classList.add('hidden');
  currentEditingId = null;
}

function previewWatchImage(input) {
  const img = document.getElementById('form-watch-image-preview');
  if (input.files && input.files[0]) {
    img.src = URL.createObjectURL(input.files[0]);
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
  }
}

function previewWatchVideo(input) {
  const container = document.getElementById('video-preview-container');
  const videoEl = document.getElementById('form-watch-video-preview');
  if (input.files && input.files[0]) {
    videoEl.src = URL.createObjectURL(input.files[0]);
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

async function handleWatchFormSubmit(e) {
  e.preventDefault();

  const brand = document.getElementById('form-watch-brand').value.trim();
  const category = document.getElementById('form-watch-category').value;
  const model = document.getElementById('form-watch-model').value.trim();
  const tagline = document.getElementById('form-watch-tagline').value.trim();
  const price = document.getElementById('form-watch-price').value.trim();
  const originalPrice = document.getElementById('form-watch-original-price').value.trim();
  const badge = document.getElementById('form-watch-badge').value;
  const movement = document.getElementById('form-watch-movement').value.trim();
  const dialSize = document.getElementById('form-watch-dial').value.trim();
  const glass = document.getElementById('form-watch-glass').value.trim();
  const strap = document.getElementById('form-watch-strap').value.trim();
  const stock = document.getElementById('form-watch-stock').value.trim();
  const isBestSeller = document.getElementById('form-watch-bestseller').checked;
  const isNewArrival = document.getElementById('form-watch-newarrival').checked;
  const isTrending = document.getElementById('form-watch-trending').checked;
  const imageUrl = document.getElementById('form-watch-image-url').value.trim();
  const description = document.getElementById('form-watch-desc').value.trim();
  const features = document.getElementById('form-watch-features').value;
  const fileInput = document.getElementById('form-watch-file');
  const videoInput = document.getElementById('form-watch-video');
  const videoUrl = document.getElementById('form-watch-video-url').value.trim();

  const formData = new FormData();
  formData.append('brand', brand);
  formData.append('category', category);
  formData.append('model', model);
  formData.append('tagline', tagline);
  formData.append('price', price);
  formData.append('originalPrice', originalPrice);
  formData.append('badge', badge);
  formData.append('movement', movement);
  formData.append('dialSize', dialSize);
  formData.append('glass', glass);
  formData.append('strap', strap);
  formData.append('stock', stock || 20);
  formData.append('isBestSeller', isBestSeller);
  formData.append('isNewArrival', isNewArrival);
  formData.append('isTrending', isTrending);
  formData.append('description', description);
  formData.append('features', features);

  if (fileInput && fileInput.files[0]) {
    formData.append('image', fileInput.files[0]);
  } else if (imageUrl) {
    formData.append('imageUrl', imageUrl);
  }

  if (videoInput && videoInput.files[0]) {
    formData.append('video', videoInput.files[0]);
  } else if (videoUrl) {
    formData.append('videoUrl', videoUrl);
  }

  const isEdit = Boolean(currentEditingId);
  const endpoint = isEdit ? `/api/products/${currentEditingId}` : '/api/products';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    showToast(isEdit ? 'Updating watch in database...' : 'Saving new watch to database...', 'info');
    const res = await fetch(endpoint, { method, body: formData });

    if (res.ok) {
      showToast(isEdit ? 'Watch updated permanently! ✅' : 'New watch uploaded successfully! ⌚', 'success');
      closeWatchModal();
      await loadAdminWatches();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to save watch', 'error');
    }
  } catch (e) {
    showToast('Network error saving watch', 'error');
  }
}

// 4. Orders Management
async function loadAdminOrders() {
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) return;
    adminOrders = await res.json();

    const totalCount = adminOrders.length;
    const totalVolume = adminOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

    const statCountEl = document.getElementById('stat-total-orders');
    const statVolEl = document.getElementById('stat-order-value');
    if (statCountEl) statCountEl.textContent = totalCount;
    if (statVolEl) statVolEl.textContent = `₹${totalVolume.toLocaleString('en-IN')}`;

    renderOrdersTable();
  } catch (e) {
    console.error('Failed to load orders', e);
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById('admin-orders-table-body');
  if (!tbody) return;

  const query = (document.getElementById('admin-search-orders')?.value || '').toLowerCase().trim();
  const filterStatus = document.getElementById('admin-filter-order-status')?.value || 'all';

  const filtered = adminOrders.filter(o => {
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchesQuery = !query ||
      (o.orderId && o.orderId.toLowerCase().includes(query)) ||
      (o.customerName && o.customerName.toLowerCase().includes(query)) ||
      (o.phone && o.phone.includes(query)) ||
      (o.city && o.city.toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="p-8 text-center text-neutral-500">
          No customer orders matching current filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const itemsSummary = (o.items || []).map(i => `${i.brand} ${i.model} (×${i.quantity || 1})`).join(', ');

    return `
      <tr class="hover:bg-neutral-900/40 transition-colors">
        <td class="p-4">
          <div class="font-mono font-bold text-amber-400">#${o.orderId}</div>
          <div class="text-[10px] text-neutral-500">${new Date(o.createdAt).toLocaleDateString('en-IN')}</div>
        </td>
        <td class="p-4 font-semibold text-white">${o.customerName || 'Customer'}</td>
        <td class="p-4 font-mono text-neutral-300">${o.phone || '-'}</td>
        <td class="p-4 text-neutral-300 max-w-xs truncate" title="${o.address || ''}, ${o.city || ''}">
          ${o.address || '-'}, ${o.city || ''} ${o.pincode ? `(${o.pincode})` : ''}
        </td>
        <td class="p-4 text-neutral-400 max-w-xs truncate" title="${itemsSummary}">
          ${itemsSummary || '-'}
        </td>
        <td class="p-4 font-extrabold text-white font-mono">₹${Number(o.total || 0).toLocaleString('en-IN')}</td>
        <td class="p-4 font-mono text-amber-400 text-xs">+${o.coinsEarned || 0}</td>
        <td class="p-4">
          <select onchange="handleOrderStatusChange('${o.orderId}', this.value)" class="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-amber-300 focus:outline-none">
            <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="Packed" ${o.status === 'Packed' ? 'selected' : ''}>Packed</option>
            <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
            <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td class="p-4 text-right">
          <div class="flex items-center justify-end gap-2">
            ${o.phone ? `
              <button onclick="chatCustomerWhatsApp('${o.phone}', '${o.orderId}', '${o.customerName}')" class="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400" title="Chat on WhatsApp">
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.288.043.088.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.203c.043.072.043.419-.101.824z"/></svg>
              </button>
            ` : ''}
            <button onclick="handleDeleteOrderPermanently('${o.orderId}')" class="p-1.5 rounded-lg bg-red-950/60 text-red-400 border border-red-500/30 hover:border-red-400" title="Delete Order">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleOrderStatusChange(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      showToast(`Order #${orderId} status set to ${newStatus}`, 'success');
      await loadAdminOrders();
    }
  } catch (e) {
    showToast('Failed to update order status', 'error');
  }
}

async function handleDeleteOrderPermanently(orderId) {
  if (!confirm(`Permanently delete order #${orderId} from the database?`)) return;
  try {
    const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Order permanently deleted', 'success');
      await loadAdminOrders();
    }
  } catch (e) {
    showToast('Failed to delete order', 'error');
  }
}

function chatCustomerWhatsApp(phone, orderId, name) {
  const clean = phone.replace(/[^0-9]/g, '');
  const msg = encodeURIComponent(`Hello ${name || ''}! This is AM COLLECTION regarding your Cash on Delivery watch order #${orderId}. We are packing your timepiece for dispatch.`);
  window.open(`https://wa.me/${clean}?text=${msg}`, '_blank');
}

// 5. Customers & Users Management
async function loadAdminUsers() {
  try {
    const res = await fetch('/api/admin/users');
    if (!res.ok) return;
    adminUsers = await res.json();

    const statCustomers = document.getElementById('stat-total-customers');
    if (statCustomers) statCustomers.textContent = adminUsers.length;

    renderUsersTable();
  } catch (e) {
    console.error('Failed to load users', e);
  }
}

function renderUsersTable() {
  const tbody = document.getElementById('admin-users-table-body');
  if (!tbody) return;

  if (adminUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-neutral-500">
          No registered customer accounts yet. When users create accounts or place orders, they will appear here!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = adminUsers.map(u => `
    <tr class="hover:bg-neutral-900/40 transition-colors">
      <td class="p-4 font-bold text-white flex items-center gap-2">
        <div class="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xs">
          ${(u.name || 'U').charAt(0).toUpperCase()}
        </div>
        <span>${u.name || 'Valued Member'}</span>
      </td>
      <td class="p-4 font-mono text-neutral-300">${u.email}</td>
      <td class="p-4 font-mono text-neutral-300">${u.phone || '-'}</td>
      <td class="p-4 font-mono font-bold text-amber-400">🪙 ${u.coinBalance || 0}</td>
      <td class="p-4 font-mono text-white">${u.totalOrders || 0}</td>
      <td class="p-4 font-mono text-emerald-400 font-semibold">₹${Number(u.totalSpent || 0).toLocaleString('en-IN')}</td>
      <td class="p-4 text-neutral-500 text-[11px]">${new Date(u.createdAt || Date.now()).toLocaleDateString('en-IN')}</td>
    </tr>
  `).join('');
}

// 6. Coupons Management
async function loadAdminCoupons() {
  try {
    const res = await fetch('/api/coupons');
    if (!res.ok) return;
    adminCoupons = await res.json();
    renderCouponsList();
  } catch (e) {
    console.error('Failed to load coupons', e);
  }
}

function renderCouponsList() {
  const container = document.getElementById('coupons-list-container');
  if (!container) return;

  if (adminCoupons.length === 0) {
    container.innerHTML = `<p class="text-neutral-500 text-xs py-4">No coupons created yet. Use the form on the left to add your first coupon.</p>`;
    return;
  }

  container.innerHTML = adminCoupons.map(c => `
    <div class="flex items-center justify-between py-3">
      <div>
        <span class="font-mono font-bold text-amber-400 text-sm tracking-wider">${c.code}</span>
        <p class="text-xs text-neutral-400">
          ${c.discountType === 'percent' ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT OFF`}
          ${c.minOrder ? `• Min order ₹${c.minOrder}` : ''}
        </p>
      </div>
      <button onclick="handleDeleteCoupon('${c.code}')" class="px-3 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-400 border border-red-500/30 text-xs font-semibold">
        Delete
      </button>
    </div>
  `).join('');
}

async function handleCreateCoupon(e) {
  e.preventDefault();
  const code = document.getElementById('coupon-code').value.trim();
  const discountType = document.getElementById('coupon-type').value;
  const discountValue = document.getElementById('coupon-value').value;
  const minOrder = document.getElementById('coupon-min-order').value;

  try {
    showToast('Creating coupon...', 'info');
    const res = await fetch('/api/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, discountType, discountValue, minOrder })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Coupon '${data.coupon.code}' created! 🎟️`, 'success');
      document.getElementById('create-coupon-form').reset();
      await loadAdminCoupons();
    } else {
      showToast(data.error || 'Failed to create coupon', 'error');
    }
  } catch (e) {
    showToast('Network error creating coupon', 'error');
  }
}

async function handleDeleteCoupon(code) {
  if (!confirm(`Delete coupon '${code}'?`)) return;
  try {
    const res = await fetch(`/api/coupons/${code}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Coupon deleted', 'success');
      await loadAdminCoupons();
    }
  } catch (e) {
    showToast('Error deleting coupon', 'error');
  }
}

// Tab Switching
function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    b.classList.remove('border-amber-400', 'text-amber-400');
    b.classList.add('border-transparent', 'text-neutral-400');
  });

  const activeBtn = document.getElementById(`tab-btn-${tab}`);
  if (activeBtn) {
    activeBtn.classList.remove('border-transparent', 'text-neutral-400');
    activeBtn.classList.add('border-amber-400', 'text-amber-400');
  }

  ['watches', 'orders', 'customers', 'branding', 'coupons'].forEach(t => {
    const sec = document.getElementById(`admin-tab-${t}`);
    if (sec) {
      if (t === tab) sec.classList.remove('hidden');
      else sec.classList.add('hidden');
    }
  });
}

// Toast System
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
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
