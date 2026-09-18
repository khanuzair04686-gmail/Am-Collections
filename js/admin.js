// AM COLLECTION - Admin Dashboard Controller Script

let adminWatches = [];
let adminOrders = [];
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
      showToast('Incorrect Admin Passkey! Please check and re-try.', 'error');
    }
  } catch (err) {
    // Offline fallback check
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

async function handleChangePasskey(e) {
  e.preventDefault();
  const currentPasskey = document.getElementById('passkey-current').value.trim();
  const newPasskey = document.getElementById('passkey-new').value.trim();
  const confirmPasskey = document.getElementById('passkey-confirm').value.trim();

  if (newPasskey !== confirmPasskey) {
    showToast('New passkeys do not match! Please check.', 'error');
    return;
  }

  if (newPasskey.length < 4) {
    showToast('New passkey must be at least 4 characters long.', 'error');
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
      showToast(data.message || 'Admin Passkey updated successfully! 🔒', 'success');
      document.getElementById('change-passkey-form').reset();
    } else {
      showToast(data.error || 'Failed to update passkey. Check current passkey.', 'error');
    }
  } catch (err) {
    showToast('Network error updating passkey.', 'error');
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

  // Passkey change form
  const passkeyForm = document.getElementById('change-passkey-form');
  if (passkeyForm) passkeyForm.addEventListener('submit', handleChangePasskey);

  // Logo upload form
  const logoForm = document.getElementById('logo-upload-form');
  if (logoForm) logoForm.addEventListener('submit', handleLogoUpload);

  // Settings form
  const settingsForm = document.getElementById('settings-text-form');
  if (settingsForm) settingsForm.addEventListener('submit', handleSettingsSubmit);

  // Watch modal form
  const watchForm = document.getElementById('watch-form');
  if (watchForm) watchForm.addEventListener('submit', handleWatchFormSubmit);

  // Search & Filter in Watch table
  const searchInput = document.getElementById('admin-search-watches');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderWatchesTable());
  }

  const filterBrand = document.getElementById('admin-filter-brand');
  if (filterBrand) {
    filterBrand.addEventListener('change', () => renderWatchesTable());
  }
}

// Load All Dashboard Data
async function loadDashboardData() {
  await Promise.all([
    checkSystemHealth(),
    loadAdminSettings(),
    loadAdminWatches(),
    loadAdminOrders()
  ]);
}

// 1. Health Status
async function checkSystemHealth() {
  const pill = document.getElementById('db-status-pill');
  const statDb = document.getElementById('stat-db-name');
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      if (pill) pill.textContent = data.database;
      if (statDb) statDb.textContent = data.database.includes('MongoDB') ? 'MongoDB Online' : 'Fallback Active';
    } else {
      if (pill) pill.textContent = 'Standalone Mode';
    }
  } catch (e) {
    if (pill) pill.textContent = 'Local Mode';
  }
}

// 2. Load & Save Settings
async function loadAdminSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const settings = await res.json();

    document.getElementById('setting-store-name').value = settings.storeName || 'AM COLLECTION';
    document.getElementById('setting-tagline').value = settings.tagline || 'Timeless Elegance - Master Copy Watches';
    document.getElementById('setting-store-phone').value = settings.storePhone || '919876543210';
    document.getElementById('setting-announcement').value = settings.announcementText || '';

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
    showToast('Please select a logo image file to upload!', 'error');
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
      showToast('Logo updated successfully across storefront! ✨', 'success');
    } else {
      showToast('Failed to upload logo image', 'error');
    }
  } catch (e) {
    showToast('Upload error', 'error');
  }
}

// 3. Watches Management
async function loadAdminWatches() {
  try {
    const res = await fetch('/api/products');
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
    const matchesBrand = brand === 'all' || w.category === brand || w.brand.toLowerCase() === brand.toLowerCase();
    const matchesQuery = !query || 
      w.brand.toLowerCase().includes(query) || 
      w.model.toLowerCase().includes(query) || 
      (w.movement && w.movement.toLowerCase().includes(query));
    return matchesBrand && matchesQuery;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-neutral-500">
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
          <img src="${w.image}" alt="${w.model}" class="w-12 h-12 rounded-xl object-cover border border-neutral-800 bg-neutral-950 flex-shrink-0" onerror="this.src='https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop'" />
          <div>
            <div class="flex items-center gap-1.5 font-bold text-white text-xs">
              ${w.model}
              ${w.videoUrl ? '<span class="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1 py-0.5" title="Has showcase video">🎥 VIDEO</span>' : ''}
            </div>
            <div class="text-[10px] text-neutral-400 truncate max-w-xs">${w.tagline || ''}</div>
          </div>
        </div>
      </td>
      <td class="p-4 font-semibold text-amber-400">${w.brand}</td>
      <td class="p-4 font-bold text-white">₹${Number(w.price).toLocaleString('en-IN')}</td>
      <td class="p-4 text-neutral-500 line-through">₹${Number(w.originalPrice).toLocaleString('en-IN')}</td>
      <td class="p-4 text-neutral-300">${w.movement || '1:1 Automatic'}</td>
      <td class="p-4">
        <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
          ${w.badge || '1:1 MASTER'}
        </span>
      </td>
      <td class="p-4 text-right">
        <div class="flex items-center justify-end gap-2">
          <button onclick="openEditWatchModal('${w.id}')" class="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-amber-300 transition-colors" title="Edit Watch Details">
            Edit
          </button>
          <button onclick="handleDeleteWatch('${w.id}', '${w.brand} ${w.model}')" class="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-500/30 transition-colors" title="Remove Watch">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ─── Video / Image Preview Helpers ───────────────────
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
  const videoEl   = document.getElementById('form-watch-video-preview');
  if (input.files && input.files[0]) {
    const url = URL.createObjectURL(input.files[0]);
    videoEl.src = url;
    container.classList.remove('hidden');
    // Clear the URL field if a file is chosen
    document.getElementById('form-watch-video-url').value = '';
    // Hide old indicator
    document.getElementById('current-video-indicator').classList.add('hidden');
  } else {
    container.classList.add('hidden');
  }
}

function clearWatchVideo() {
  document.getElementById('form-watch-video').value = '';
  document.getElementById('form-watch-video-url').value = 'REMOVE';
  document.getElementById('video-preview-container').classList.add('hidden');
  document.getElementById('current-video-indicator').classList.add('hidden');
}

// Add / Edit Watch Modals
function openAddWatchModal() {
  currentEditingId = null;
  document.getElementById('watch-modal-title').textContent = 'UPLOAD NEW MASTER WATCH';
  document.getElementById('watch-form').reset();
  document.getElementById('form-watch-id').value = '';
  // Reset media previews
  document.getElementById('form-watch-image-preview').classList.add('hidden');
  document.getElementById('video-preview-container').classList.add('hidden');
  document.getElementById('current-video-indicator').classList.add('hidden');
  document.getElementById('watch-modal').classList.remove('hidden');
}

function openEditWatchModal(id) {
  const watch = adminWatches.find(w => w.id === id);
  if (!watch) return;

  currentEditingId = id;
  document.getElementById('watch-modal-title').textContent = `EDIT ${watch.brand} ${watch.model}`;

  document.getElementById('form-watch-id').value = watch.id;
  document.getElementById('form-watch-brand').value = watch.brand;
  document.getElementById('form-watch-category').value = watch.category || 'other';
  document.getElementById('form-watch-model').value = watch.model;
  document.getElementById('form-watch-tagline').value = watch.tagline || '';
  document.getElementById('form-watch-price').value = watch.price;
  document.getElementById('form-watch-original-price').value = watch.originalPrice;
  document.getElementById('form-watch-badge').value = watch.badge || '';
  document.getElementById('form-watch-movement').value = watch.movement || '';
  document.getElementById('form-watch-dial').value = watch.dialSize || '';
  document.getElementById('form-watch-glass').value = watch.glass || '';
  document.getElementById('form-watch-strap').value = watch.strap || '';
  document.getElementById('form-watch-image-url').value = watch.image || '';
  document.getElementById('form-watch-desc').value = watch.description || '';
  document.getElementById('form-watch-features').value = Array.isArray(watch.features) ? watch.features.join('\n') : (watch.features || '');

  // Reset media previews
  document.getElementById('form-watch-image-preview').classList.add('hidden');
  document.getElementById('video-preview-container').classList.add('hidden');

  // Show existing video indicator
  const videoIndicator = document.getElementById('current-video-indicator');
  const videoName      = document.getElementById('current-video-name');
  if (watch.videoUrl && watch.videoUrl !== 'REMOVE') {
    document.getElementById('form-watch-video-url').value = watch.videoUrl;
    const shortName = watch.videoUrl.split('/').pop();
    videoName.textContent = `Current video: ${shortName}`;
    videoIndicator.classList.remove('hidden');
  } else {
    document.getElementById('form-watch-video-url').value = '';
    videoIndicator.classList.add('hidden');
  }

  document.getElementById('watch-modal').classList.remove('hidden');
}

function closeWatchModal() {
  document.getElementById('watch-modal').classList.add('hidden');
  document.getElementById('video-preview-container').classList.add('hidden');
  document.getElementById('current-video-indicator').classList.add('hidden');
  currentEditingId = null;
}

// Handle Watch Form Submit
async function handleWatchFormSubmit(e) {
  e.preventDefault();

  const brand         = document.getElementById('form-watch-brand').value.trim();
  const category      = document.getElementById('form-watch-category').value;
  const model         = document.getElementById('form-watch-model').value.trim();
  const tagline       = document.getElementById('form-watch-tagline').value.trim();
  const price         = document.getElementById('form-watch-price').value.trim();
  const originalPrice = document.getElementById('form-watch-original-price').value.trim();
  const badge         = document.getElementById('form-watch-badge').value.trim() || '1:1 MASTER';
  const movement      = document.getElementById('form-watch-movement').value.trim();
  const dialSize      = document.getElementById('form-watch-dial').value.trim();
  const glass         = document.getElementById('form-watch-glass').value.trim();
  const strap         = document.getElementById('form-watch-strap').value.trim();
  const imageUrl      = document.getElementById('form-watch-image-url').value.trim();
  const description   = document.getElementById('form-watch-desc').value.trim();
  const features      = document.getElementById('form-watch-features').value;
  const fileInput     = document.getElementById('form-watch-file');
  const videoInput    = document.getElementById('form-watch-video');
  const videoUrl      = document.getElementById('form-watch-video-url').value.trim();

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
  formData.append('description', description);
  formData.append('features', features);

  // Image
  if (fileInput && fileInput.files[0]) {
    formData.append('image', fileInput.files[0]);
  } else if (imageUrl) {
    formData.append('imageUrl', imageUrl);
  }

  // Video
  if (videoInput && videoInput.files[0]) {
    formData.append('video', videoInput.files[0]);
  } else if (videoUrl) {
    // 'REMOVE' means user explicitly removed — send empty string
    formData.append('videoUrl', videoUrl === 'REMOVE' ? '' : videoUrl);
  }

  const isEdit   = Boolean(currentEditingId);
  const endpoint = isEdit ? `/api/products/${currentEditingId}` : '/api/products';
  const method   = isEdit ? 'PUT' : 'POST';

  try {
    showToast(isEdit ? 'Updating watch...' : 'Saving watch to catalog...', 'info');
    const res = await fetch(endpoint, { method, body: formData });

    if (res.ok) {
      showToast(isEdit ? 'Watch updated successfully! ✅' : 'New watch uploaded successfully! ⌚', 'success');
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

// Handle Delete Watch
async function handleDeleteWatch(id, title) {
  if (!confirm(`Are you sure you want to permanently remove "${title}" from the catalog?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/products/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast(`Removed "${title}" from catalog`, 'success');
      await loadAdminWatches();
    } else {
      showToast('Failed to delete watch', 'error');
    }
  } catch (e) {
    showToast('Error deleting watch', 'error');
  }
}

// Reset Watches to Defaults
async function handleResetDefaultWatches() {
  if (!confirm('Restore the default 12 curated luxury master copy timepieces? This will re-seed the catalog.')) {
    return;
  }

  try {
    showToast('Restoring default collection...', 'info');
    const res = await fetch('/api/products/reset', { method: 'POST' });
    if (res.ok) {
      showToast('Master collection restored! 🌟', 'success');
      await loadAdminWatches();
    } else {
      showToast('Failed to reset catalog', 'error');
    }
  } catch (e) {
    showToast('Error resetting catalog', 'error');
  }
}

// 4. Orders Management
async function loadAdminOrders() {
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) return;
    adminOrders = await res.json();

    // Stats
    const totalCount = adminOrders.length;
    const totalVolume = adminOrders.reduce((acc, o) => acc + (o.total || 0), 0);

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

  if (adminOrders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-neutral-500">
          No customer orders recorded yet. When customers place Cash on Delivery or WhatsApp orders, they will appear here!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = adminOrders.map(o => {
    const cust = o.customer || {};
    const itemsSummary = (o.items || []).map(i => `${i.brand} ${i.model} (×${i.quantity || 1})`).join(', ');

    return `
      <tr class="hover:bg-neutral-900/40 transition-colors">
        <td class="p-4">
          <div class="font-mono font-bold text-amber-400">#${o.orderId}</div>
          <div class="text-[10px] text-neutral-500">${o.displayDate || new Date(o.createdAt).toLocaleDateString()}</div>
        </td>
        <td class="p-4 font-semibold text-white">${cust.fullName || 'Customer'}</td>
        <td class="p-4 font-mono text-neutral-300">
          <div>${cust.phone || '-'}</div>
          ${cust.altPhone ? `<div class="text-[10px] text-neutral-500">Alt: ${cust.altPhone}</div>` : ''}
        </td>
        <td class="p-4 text-neutral-300 max-w-xs truncate" title="${cust.address || ''}, ${cust.city || ''} ${cust.pincode || ''}">
          ${cust.address || '-'}, ${cust.city || ''} ${cust.pincode ? `(${cust.pincode})` : ''}
        </td>
        <td class="p-4 text-neutral-400 max-w-xs truncate" title="${itemsSummary}">
          ${itemsSummary || '-'}
        </td>
        <td class="p-4 font-extrabold text-amber-400">₹${Number(o.total || 0).toLocaleString('en-IN')}</td>
        <td class="p-4">
          <select onchange="handleOrderStatusChange('${o.orderId}', this.value)" class="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-amber-300 focus:outline-none">
            <option value="Pending COD Dispatch" ${o.status === 'Pending COD Dispatch' ? 'selected' : ''}>Pending COD</option>
            <option value="Dispatched (In Transit)" ${o.status === 'Dispatched (In Transit)' ? 'selected' : ''}>Dispatched</option>
            <option value="Delivered & Paid" ${o.status === 'Delivered & Paid' ? 'selected' : ''}>Delivered & Paid</option>
            <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td class="p-4 text-right">
          <div class="flex items-center justify-end gap-2">
            ${cust.phone ? `
              <button onclick="chatCustomerWhatsApp('${cust.phone}', '${o.orderId}', '${cust.fullName}')" class="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400" title="Chat on WhatsApp">
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.288.043.088.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.203c.043.072.043.419-.101.824z"/></svg>
              </button>
            ` : ''}
            <button onclick="handleDeleteOrder('${o.orderId}')" class="p-1.5 rounded-lg bg-red-950/60 text-red-400 border border-red-500/30 hover:border-red-400" title="Delete Order Record">
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
      showToast(`Order #${orderId} marked as "${newStatus}"`, 'success');
    }
  } catch (e) {
    showToast('Failed to update order status', 'error');
  }
}

async function handleDeleteOrder(orderId) {
  if (!confirm(`Delete order #${orderId}?`)) return;
  try {
    const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Order removed', 'success');
      await loadAdminOrders();
    }
  } catch (e) {
    showToast('Failed to delete order', 'error');
  }
}

function chatCustomerWhatsApp(phone, orderId, name) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const msg = encodeURIComponent(`Hello ${name || ''}! This is AM COLLECTION regarding your watch order #${orderId}. We are preparing your order for dispatch.`);
  window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
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

  ['branding', 'watches', 'orders'].forEach(t => {
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
