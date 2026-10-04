// sabrXwatches - Enterprise Admin Management Portal Controller
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
      sessionStorage.setItem('amc_admin_passkey', passkey);
      const modal = document.getElementById('auth-modal');
      if (modal) modal.classList.add('hidden');
      showToast('Admin Access Granted! Welcome to sabrXwatches Portal. 👑', 'success');
      loadDashboardData();
    } else {
      showToast('Incorrect Admin Passkey! Please check and retry.', 'error');
    }
  } catch (err) {
    if (passkey === 'admin123') {
      sessionStorage.setItem('amc_admin_auth', 'true');
      sessionStorage.setItem('amc_admin_passkey', passkey);
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
  sessionStorage.removeItem('amc_admin_passkey');
  location.reload();
}

// Adds the admin passkey header required by protected server routes
function adminHeaders(json = true) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  const key = sessionStorage.getItem('amc_admin_passkey');
  if (key) h['x-admin-passkey'] = key;
  return h;
}

// ─── REAL-TIME STOREFRONT SYNC ─────────────────────────────
// Signal only — MongoDB stays the single source of truth. The storefront
// reacts by re-fetching /api/products, it never reads data from here.
let adminSyncChannel = null;
try {
  if (typeof BroadcastChannel !== 'undefined') adminSyncChannel = new BroadcastChannel('amc-store-sync');
} catch (e) { adminSyncChannel = null; }

function broadcastStoreChange(scope = 'catalog') {
  const type = scope === 'settings' ? 'settings-changed' : 'catalog-changed';
  if (adminSyncChannel) {
    try { adminSyncChannel.postMessage({ type, at: Date.now() }); } catch (e) {}
  }
  try { localStorage.setItem(scope === 'settings' ? 'amc_settings_sync' : 'amc_catalog_sync', String(Date.now())); } catch (e) {}
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

  const aboutForm = document.getElementById('about-form');
  if (aboutForm) aboutForm.addEventListener('submit', handleAboutSubmit);

  const searchInput = document.getElementById('admin-search-watches');
  if (searchInput) searchInput.addEventListener('input', () => renderWatchesTable());

  const filterBrand = document.getElementById('admin-filter-brand');
  if (filterBrand) filterBrand.addEventListener('change', () => renderWatchesTable());

  const searchOrders = document.getElementById('admin-search-orders');
  if (searchOrders) searchOrders.addEventListener('input', () => renderOrdersTable());

  const filterOrderStatus = document.getElementById('admin-filter-order-status');
  if (filterOrderStatus) filterOrderStatus.addEventListener('change', () => renderOrdersTable());

  const searchCustomers = document.getElementById('admin-search-customers');
  if (searchCustomers) searchCustomers.addEventListener('input', () => renderUsersTable());

  const filterCustomerStatus = document.getElementById('admin-filter-customer-status');
  if (filterCustomerStatus) filterCustomerStatus.addEventListener('change', () => renderUsersTable());

  const bulkFileInput = document.getElementById('bulk-csv-file');
  if (bulkFileInput) bulkFileInput.addEventListener('change', () => handleBulkCsvFile(bulkFileInput));

  const bulkTextArea = document.getElementById('bulk-csv-text');
  if (bulkTextArea) bulkTextArea.addEventListener('input', updateBulkRowCount);

  const bulkTemplateLink = document.getElementById('bulk-csv-template');
  if (bulkTemplateLink) {
    bulkTemplateLink.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(BULK_CSV_HEADERS.join(',') + '\r\n');
  }
}

// Load All Dashboard Data
async function loadDashboardData() {
  await Promise.allSettled([
    checkSystemHealth(),
    loadAdminSettings(),
    loadAdminWatches(),
    loadAdminOrders(),
    loadAdminUsers(),
    loadAdminCoupons(),
    loadAdminAbout()
  ]);
}

// 1. Health Status & Stats
async function checkSystemHealth() {
  const pill = document.getElementById('db-status-pill');
  const dot = document.getElementById('db-status-dot');
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    const data = await res.json();
    if (res.ok && data.connected) {
      if (pill) {
        pill.textContent = data.database || 'MongoDB Atlas — Connected';
        pill.className = 'text-emerald-400 font-semibold';
      }
      if (dot) {
        dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      }
    } else {
      if (pill) {
        pill.textContent = data.database || 'MongoDB Atlas — Disconnected';
        pill.className = 'text-red-400 font-semibold';
      }
      if (dot) {
        dot.className = 'w-2 h-2 rounded-full bg-red-500';
      }
    }
  } catch (e) {
    if (pill) {
      pill.textContent = 'MongoDB Atlas — Disconnected';
      pill.className = 'text-red-400 font-semibold';
    }
    if (dot) {
      dot.className = 'w-2 h-2 rounded-full bg-red-500';
    }
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

    if (nameInput) nameInput.value = settings.storeName || 'sabrXwatches';
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
      headers: adminHeaders(),
      body: JSON.stringify({ storeName, storePhone, tagline, announcementText })
    });

    if (res.ok) {
      showToast('Store settings saved successfully! 💎', 'success');
      broadcastStoreChange('settings');
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
      headers: adminHeaders(false),
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
      broadcastStoreChange('settings');
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
    const res = await fetch('/api/settings/logo', { method: 'DELETE', headers: adminHeaders(false) });
    if (res.ok) {
      const preview = document.getElementById('branding-logo-preview');
      const placeholder = document.getElementById('branding-logo-placeholder');
      preview.src = '';
      preview.classList.add('hidden');
      placeholder.classList.remove('hidden');
      showToast('Logo removed permanently.', 'success');
      broadcastStoreChange('settings');
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
      headers: adminHeaders(),
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
  const tbody = document.getElementById('admin-watches-table-body');
  if (tbody && adminWatches.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-neutral-400">
          <div class="flex items-center justify-center gap-2">
            <svg class="animate-spin h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span class="font-medium text-xs">Loading watches from MongoDB Atlas...</span>
          </div>
        </td>
      </tr>
    `;
  }
  try {
    const res = await fetch('/api/products?includeHidden=true', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="p-8 text-center text-red-400 font-semibold">
              ⚠️ Database Connection Issue: ${errData.message || 'Could not load watches from MongoDB Atlas'}.
            </td>
          </tr>
        `;
      }
      return;
    }
    adminWatches = await res.json();

    const statCount = document.getElementById('stat-total-watches');
    if (statCount) statCount.textContent = adminWatches.length;

    renderWatchesTable();
  } catch (e) {
    console.error('Failed to load watches', e);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="p-8 text-center text-red-400 font-semibold">
            ⚠️ Database Disconnected. Failed to load watches.
          </td>
        </tr>
      `;
    }
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
    <tr class="hover:bg-[#161B25]/40 transition-colors">
      <td class="p-4">
        <div class="flex items-center gap-3">
          <img src="${w.image}" alt="${w.model}" class="w-12 h-12 rounded-xl object-contain border border-[#1F2632] bg-black flex-shrink-0" onerror="this.onerror=null;this.src=AMC_ADMIN_PLACEHOLDER" />
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
        <span class="px-2 py-0.5 rounded bg-[#1B222C] text-neutral-300 text-[10px] font-bold">
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
          <button onclick="openEditWatchModal('${w.id}')" class="px-3 py-1.5 rounded-lg bg-[#1B222C] hover:bg-[#252E3B] text-neutral-200 hover:text-amber-300 transition-colors" title="Edit Watch Details">
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
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE', headers: adminHeaders(false) });
    if (res.ok) {
      showToast(`"${title}" permanently removed from database! 🗑️`, 'success');
      await loadAdminWatches();
      broadcastStoreChange('catalog');
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
      headers: adminHeaders(),
      body: JSON.stringify({ field: 'isHidden' })
    });
    if (res.ok) {
      await loadAdminWatches();
      broadcastStoreChange('catalog');
    }
  } catch (e) {}
}

// Manual Seed catalog button
async function handleSeedCatalog() {
  if (!confirm('Populate the default curated 8 master copy watches into the catalog?')) return;
  try {
    showToast('Populating watches...', 'info');
    const res = await fetch('/api/admin/seed-defaults', { method: 'POST', headers: adminHeaders(false) });
    if (res.ok) {
      showToast('Curated collection populated! 🌟', 'success');
      await loadAdminWatches();
      broadcastStoreChange('catalog');
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
  ['form-watch-dial-color', 'form-watch-case-color', 'form-watch-case-material', 'form-watch-strap-color',
    'form-watch-dial-shape', 'form-watch-water-resistance', 'form-watch-additional-images']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('form-watch-id').value = '';
  document.getElementById('form-watch-image-preview').classList.add('hidden');
  document.getElementById('video-preview-container').classList.add('hidden');
  document.getElementById('watch-modal').classList.remove('hidden');
}

// "Not Specified" is the server's stored placeholder — show it as an empty field so
// admins see a real gap to fill instead of a value they must delete first.
function editableSpecValue(value) {
  const v = (value || '').trim();
  return v.toLowerCase() === 'not specified' ? '' : v;
}

function openEditWatchModal(id) {
  const watch = adminWatches.find(w => w.id === id);
  if (!watch) return;

  currentEditingId = id;
  document.getElementById('watch-modal-title').textContent = `EDIT ${watch.brand} ${watch.model}`;

  document.getElementById('form-watch-id').value = watch.id;
  document.getElementById('form-watch-brand').value = watch.brand === 'Unbranded' ? '' : (watch.brand || '');
  document.getElementById('form-watch-category').value = watch.category || 'other';
  document.getElementById('form-watch-model').value = watch.model || '';
  document.getElementById('form-watch-tagline').value = watch.tagline || '';
  document.getElementById('form-watch-price').value = watch.price || '';
  document.getElementById('form-watch-original-price').value = watch.originalPrice || '';
  document.getElementById('form-watch-badge').value = watch.badge || '1:1 MASTER';
  document.getElementById('form-watch-movement').value = editableSpecValue(watch.movement);
  document.getElementById('form-watch-dial').value = editableSpecValue(watch.dialSize);
  document.getElementById('form-watch-glass').value = editableSpecValue(watch.glass);
  document.getElementById('form-watch-strap').value = editableSpecValue(watch.strap);
  document.getElementById('form-watch-dial-color').value = editableSpecValue(watch.dialColor);
  document.getElementById('form-watch-case-color').value = editableSpecValue(watch.caseColor);
  document.getElementById('form-watch-case-material').value = editableSpecValue(watch.caseMaterial);
  document.getElementById('form-watch-strap-color').value = editableSpecValue(watch.strapColor);
  document.getElementById('form-watch-dial-shape').value = editableSpecValue(watch.dialShape);
  document.getElementById('form-watch-water-resistance').value = editableSpecValue(watch.waterResistance);
  document.getElementById('form-watch-additional-images').value = Array.isArray(watch.additionalImages) ? watch.additionalImages.join('\n') : '';
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

// Serverless disk is ephemeral, so an uploaded file can vanish while its URL stays
// in the database. Downsizing the image and storing it inside the product document
// keeps MongoDB the only source of truth for the picture too.
async function imageToEmbeddedDataUrl(file, maxDim = 900, quality = 0.8) {
  if (!file || !file.type.startsWith('image/')) return null;
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function handleWatchFormSubmit(e) {
  e.preventDefault();

  const brand = document.getElementById('form-watch-brand').value.trim() || 'Unbranded';
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
  const dialColor = document.getElementById('form-watch-dial-color').value.trim();
  const caseColor = document.getElementById('form-watch-case-color').value.trim();
  const caseMaterial = document.getElementById('form-watch-case-material').value.trim();
  const strapColor = document.getElementById('form-watch-strap-color').value.trim();
  const dialShape = document.getElementById('form-watch-dial-shape').value.trim();
  const waterResistance = document.getElementById('form-watch-water-resistance').value.trim();
  const additionalImages = document.getElementById('form-watch-additional-images').value.trim();
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
  formData.append('dialColor', dialColor);
  formData.append('caseColor', caseColor);
  formData.append('caseMaterial', caseMaterial);
  formData.append('strapColor', strapColor);
  formData.append('dialShape', dialShape);
  formData.append('waterResistance', waterResistance);
  formData.append('additionalImages', additionalImages);
  formData.append('stock', stock || 20);
  formData.append('isBestSeller', isBestSeller);
  formData.append('isNewArrival', isNewArrival);
  formData.append('isTrending', isTrending);
  formData.append('description', description);
  formData.append('features', features);

  let embeddedImage = imageUrl;
  if (fileInput && fileInput.files[0]) {
    const dataUrl = await imageToEmbeddedDataUrl(fileInput.files[0]);
    if (dataUrl) {
      embeddedImage = dataUrl;
    } else {
      // Formats canvas can't re-encode (gif/svg/…) still go through as a file
      formData.append('image', fileInput.files[0]);
      embeddedImage = '';
    }
  }
  if (embeddedImage) formData.append('imageUrl', embeddedImage);

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
    const res = await fetch(endpoint, { method, headers: adminHeaders(false), body: formData });

    if (res.ok) {
      // Use the document MongoDB actually returned, not a locally guessed object
      const data = await res.json().catch(() => null);
      const savedProduct = data && data.product ? data.product : null;

      if (savedProduct) {
        const idx = adminWatches.findIndex(w => w.id === savedProduct.id);
        if (idx > -1) adminWatches[idx] = savedProduct;
        else adminWatches.unshift(savedProduct);
        renderWatchesTable();
      }

      showToast(isEdit ? 'Watch updated permanently! ✅' : 'New watch uploaded successfully! ⌚', 'success');
      closeWatchModal();
      await loadAdminWatches();
      broadcastStoreChange('catalog');
    } else {
      const err = await res.json().catch(() => ({}));
      // A 409 means brand+model already exists — the server's own wording is the useful part
      const detail = err && err.error ? err.error : (res.status === 409 ? 'Duplicate brand and model already in catalog' : 'Failed to save watch');
      showToast(detail, 'error');
    }
  } catch (e) {
    showToast('Network error saving watch', 'error');
  }
}

// Bulk Catalog CSV Import
const BULK_CSV_HEADERS = ['productName', 'brandName', 'category', 'modelName', 'tagline', 'sellingPrice', 'referenceMRP',
  'badge', 'movement', 'dialColor', 'caseColor', 'caseMaterial', 'strapMaterial', 'strapColor', 'dialShape',
  'dialDiameter', 'glassMaterial', 'waterResistance', 'stockCount', 'description', 'keyFeatures', 'image'];

const BULK_CSV_KEY_LOOKUP = BULK_CSV_HEADERS.reduce((acc, key) => {
  acc[normalizeCsvHeader(key)] = key;
  return acc;
}, {});

function normalizeCsvHeader(header) {
  return String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsv(text) {
  const rows = [];
  let cells = [];
  let field = '';
  let inQuotes = false;
  const src = String(text == null ? '' : text);

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch !== '"') { field += ch; continue; }
      if (src[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = false;
      continue;
    }
    if (ch === '"' && field === '') { inQuotes = true; continue; }
    if (ch === ',') { cells.push(field); field = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      cells.push(field);
      field = '';
      rows.push(cells);
      cells = [];
      continue;
    }
    field += ch;
  }
  if (field !== '' || cells.length) {
    cells.push(field);
    rows.push(cells);
  }
  return rows;
}

function extractBulkProducts(text) {
  const grid = parseCsv(text).filter(cells => cells.some(c => String(c).trim() !== ''));
  if (grid.length < 2) return [];

  const headers = grid[0].map(normalizeCsvHeader);
  return grid.slice(1).map(cells => {
    const row = {};
    headers.forEach((header, idx) => {
      const key = BULK_CSV_KEY_LOOKUP[header];
      if (!key) return;
      let value = String(cells[idx] == null ? '' : cells[idx]).trim();
      if (value.toLowerCase() === 'not specified') value = '';
      if (value !== '') row[key] = value;
    });
    return Object.keys(row).length ? row : null;
  }).filter(Boolean);
}

function updateBulkRowCount() {
  const countEl = document.getElementById('bulk-rows-count');
  if (!countEl) return;
  const text = document.getElementById('bulk-csv-text')?.value || '';
  const count = extractBulkProducts(text).length;
  countEl.textContent = `${count} ${count === 1 ? 'row' : 'rows'} ready`;
}

async function handleBulkCsvFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const textarea = document.getElementById('bulk-csv-text');
    if (textarea) textarea.value = text;
    updateBulkRowCount();
    if (!extractBulkProducts(text).length) {
      showToast('That CSV has no data rows — a header line plus at least one product row is required.', 'error');
    }
  } catch (e) {
    showToast('Could not read that CSV file', 'error');
  }
}

function renderBulkSummary(data) {
  const box = document.getElementById('bulk-upload-summary');
  if (!box) return;

  const created = data.created || [];
  const skipped = data.skipped || [];
  const invalid = data.invalid || [];

  const chip = (label, count, cls) => `<span class="px-3 py-1.5 rounded-xl border font-bold ${cls}">${escHtml(label)}: ${escHtml(count)}</span>`;
  const detailLine = (label, list) => list.length === 0 ? '' : `
    <p class="text-neutral-400 mt-2 break-words">
      <span class="font-bold text-neutral-200">${escHtml(label)}</span>${escHtml(list.map(item => `#${item.row}${item.model ? ' — ' + item.model : ''}${item.error ? ' (' + item.error + ')' : ''}`).join(', '))}
    </p>
  `;

  box.className = 'text-xs rounded-2xl border p-4 bg-[#0B0E13] border-amber-500/30 space-y-1';
  box.innerHTML = `
    <p class="font-bold text-white">Bulk import finished — ${escHtml(data.total || 0)} row(s) processed</p>
    <div class="flex flex-wrap gap-2 pt-1">
      ${chip('Created', created.length, 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30')}
      ${chip('Skipped (already in catalog)', skipped.length, 'bg-amber-950/60 text-amber-300 border-amber-500/30')}
      ${chip('Invalid', invalid.length, 'bg-red-950/60 text-red-300 border-red-500/30')}
    </div>
    ${detailLine('Skipped rows:', skipped)}
    ${detailLine('Invalid rows:', invalid)}
  `;
}

async function handleBulkUpload() {
  const text = document.getElementById('bulk-csv-text')?.value || '';
  const products = extractBulkProducts(text);

  if (products.length === 0) {
    showToast('Paste CSV rows or choose a file first — a header line plus at least one product row is required.', 'error');
    return;
  }
  if (products.length > 200) {
    showToast('Bulk upload is limited to 200 products per run. Split the file and try again.', 'error');
    return;
  }

  const uploadBtn = document.getElementById('bulk-upload-btn');
  if (uploadBtn) uploadBtn.disabled = true;

  try {
    showToast(`Uploading ${products.length} product(s) to the catalog...`, 'info');
    const res = await fetch('/api/products/bulk', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ products })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      renderBulkSummary(data);
      showToast(`Bulk upload done — ${(data.created || []).length} created, ${(data.skipped || []).length} skipped, ${(data.invalid || []).length} invalid.`, 'success');
      const textarea = document.getElementById('bulk-csv-text');
      if (textarea) textarea.value = '';
      const fileInput = document.getElementById('bulk-csv-file');
      if (fileInput) fileInput.value = '';
      updateBulkRowCount();
      await loadAdminWatches();
      broadcastStoreChange('catalog');
    } else {
      showToast(data.error || 'Bulk catalog upload failed', 'error');
    }
  } catch (e) {
    showToast('Network error during bulk upload', 'error');
  } finally {
    if (uploadBtn) uploadBtn.disabled = false;
  }
}

// 4. Orders Management
async function loadAdminOrders() {
  try {
    const res = await fetch('/api/orders', { headers: adminHeaders(false) });
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

  // Destroy stale Leaflet instances before re-rendering rows
  Object.keys(adminOrderMaps).forEach((k) => {
    try { adminOrderMaps[k].remove(); } catch (e) {}
    delete adminOrderMaps[k];
  });

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
    const hasLoc = o.deliveryLocation && Number.isFinite(o.deliveryLocation.latitude) && Number.isFinite(o.deliveryLocation.longitude);

    const detailRow = `
      <tr id="order-detail-row-${o.orderId}" class="hidden">
        <td colspan="9" class="p-0 bg-[#0A0D12] border-b border-[#1F2632]">
          <div class="p-4 grid md:grid-cols-2 gap-4 text-xs">
            <div class="space-y-1">
              <p class="font-bold text-[#E2CFA5] uppercase tracking-wider text-[10px] mb-2">Customer Address</p>
              <p class="text-white font-semibold">${escHtml(o.customerName)}</p>
              <p class="text-neutral-300 font-mono">${escHtml(o.phone)}${o.altPhone ? ` / ${escHtml(o.altPhone)}` : ''}</p>
              <p class="text-neutral-400 leading-relaxed">${escHtml(o.address)}${o.landmark ? `, ${escHtml(o.landmark)}` : ''}</p>
              <p class="text-neutral-400">${escHtml(o.city)}, ${escHtml(o.state)}${o.pincode ? ` — ${escHtml(o.pincode)}` : ''}</p>
            </div>
            ${hasLoc ? `
            <div class="space-y-2">
              <p class="font-bold text-[#E2CFA5] uppercase tracking-wider text-[10px]">📍 Delivery Location</p>
              <div id="order-map-${o.orderId}" class="w-full h-48 rounded-xl overflow-hidden border border-[#1F2632] bg-[#0B0E13]"></div>
              <p class="font-mono text-neutral-300">${o.deliveryLocation.latitude}, ${o.deliveryLocation.longitude}${o.deliveryLocation.accuracy ? ` (±${Math.round(o.deliveryLocation.accuracy)}m)` : ''}</p>
              ${o.deliveryLocation.address ? `<p class="text-neutral-400 leading-relaxed">${escHtml(o.deliveryLocation.address)}</p>` : ''}
              ${o.locationCapturedAt ? `<p class="text-neutral-500 text-[10px]">Captured: ${new Date(o.locationCapturedAt).toLocaleString('en-IN')}</p>` : ''}
              <a href="https://www.google.com/maps?q=${o.deliveryLocation.latitude},${o.deliveryLocation.longitude}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161B25] border border-[#C9A96E]/40 text-[#E2CFA5] font-bold hover:border-[#C9A96E] transition-colors">
                Open in Maps ↗
              </a>
            </div>` : `
            <div class="flex items-center justify-center min-h-[8rem] rounded-xl border border-dashed border-[#1F2632] text-neutral-500 font-semibold">
              📍 Location not provided
            </div>`}
          </div>
        </td>
      </tr>
    `;

    return `
      <tr class="hover:bg-[#161B25]/40 transition-colors">
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
          <select onchange="handleOrderStatusChange('${o.orderId}', this.value)" class="bg-[#0B0E13] border border-[#1F2632] rounded-lg px-2.5 py-1 text-[11px] font-semibold text-amber-300 focus:outline-none">
            <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="Packed" ${o.status === 'Packed' ? 'selected' : ''}>Packed</option>
            <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
            <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td class="p-4 text-right">
          <div class="flex items-center justify-end gap-2">
            <button onclick="toggleOrderDetails('${o.orderId}')" class="p-1.5 rounded-lg ${hasLoc ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400' : 'bg-[#161B25] text-neutral-500 border border-[#1F2632] hover:border-neutral-400'}" title="${hasLoc ? 'View saved delivery location map' : 'Order details'}">
              📍
            </button>
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
      ${detailRow}
    `;
  }).join('');
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const adminOrderMaps = {};

function toggleOrderDetails(orderId) {
  const row = document.getElementById(`order-detail-row-${orderId}`);
  if (!row) return;
  const willShow = row.classList.contains('hidden');
  row.classList.toggle('hidden');
  if (!willShow) return;
  const order = adminOrders.find(o => o.orderId === orderId);
  if (order && order.deliveryLocation && Number.isFinite(order.deliveryLocation.latitude) && !adminOrderMaps[orderId]) {
    setTimeout(() => initOrderMap(order), 60);
  } else if (adminOrderMaps[orderId]) {
    setTimeout(() => adminOrderMaps[orderId].invalidateSize(), 60);
  }
}

// Renders the SAVED customer coordinates only — never the admin's own location
function initOrderMap(order) {
  if (typeof L === 'undefined') return;
  const el = document.getElementById(`order-map-${order.orderId}`);
  if (!el || adminOrderMaps[order.orderId]) return;
  const lat = order.deliveryLocation.latitude;
  const lng = order.deliveryLocation.longitude;
  const map = L.map(el, { zoomControl: true, scrollWheelZoom: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  map.setView([lat, lng], 16);
  L.marker([lat, lng]).addTo(map);
  if (order.deliveryLocation.accuracy) {
    L.circle([lat, lng], { radius: order.deliveryLocation.accuracy, color: '#C9A96E', fillColor: '#C9A96E', fillOpacity: 0.12, weight: 1 }).addTo(map);
  }
  adminOrderMaps[order.orderId] = map;
  setTimeout(() => map.invalidateSize(), 80);
}

async function handleOrderStatusChange(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: adminHeaders(),
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
    const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE', headers: adminHeaders(false) });
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
  const msg = encodeURIComponent(`Hello ${name || ''}! This is sabrXwatches regarding your Cash on Delivery watch order #${orderId}. We are packing your timepiece for dispatch.`);
  window.open(`https://wa.me/${clean}?text=${msg}`, '_blank');
}

// 5. Customers & Users Management
async function loadAdminUsers() {
  try {
    const res = await fetch('/api/admin/users', { headers: adminHeaders(false), cache: 'no-store' });
    if (!res.ok) return;
    adminUsers = await res.json();

    const statCustomers = document.getElementById('stat-total-customers');
    if (statCustomers) statCustomers.textContent = adminUsers.length;

    renderUsersTable();
  } catch (e) {
    console.error('Failed to load users', e);
  }
}

function fmtAdminDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

function fmtAdminDateTime(value) {
  if (!value) return 'Never';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Never' : d.toLocaleString('en-IN');
}

function renderUsersTable() {
  const tbody = document.getElementById('admin-users-table-body');
  if (!tbody) return;

  const query = (document.getElementById('admin-search-customers')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('admin-filter-customer-status')?.value || 'all';

  const filtered = adminUsers.filter(u => {
    const status = (u.status || 'Active').toLowerCase();
    if (statusFilter === 'active' && status !== 'active') return false;
    if (statusFilter === 'deleted' && status !== 'deleted') return false;
    if (!query) return true;
    return [u.name, u.email, u.phone].some(v => String(v || '').toLowerCase().includes(query));
  });

  if (filtered.length === 0) {
    const emptyMsg = adminUsers.length === 0
      ? 'No registered customer accounts yet. When users create accounts or place orders, they will appear here!'
      : 'No customers match the current search or status filter.';
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-neutral-500">${emptyMsg}</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    const isDeleted = (u.status || 'Active').toLowerCase() === 'deleted';
    return `
      <tr class="hover:bg-[#161B25]/40 transition-colors">
        <td class="p-4">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xs flex-shrink-0">
              ${escHtml((u.name || 'U').charAt(0).toUpperCase())}
            </div>
            <span class="font-bold text-white break-words">${escHtml(u.name || 'Valued Member')}</span>
          </div>
        </td>
        <td class="p-4 font-mono text-neutral-300 break-all">${escHtml(u.email || '—')}</td>
        <td class="p-4 font-mono text-neutral-300">${escHtml(u.phone || '—')}</td>
        <td class="p-4 text-neutral-400 whitespace-nowrap">${escHtml(fmtAdminDate(u.createdAt))}</td>
        <td class="p-4 text-neutral-400 whitespace-nowrap">${escHtml(fmtAdminDateTime(u.lastLogin))}</td>
        <td class="p-4 font-mono text-white">${escHtml(u.totalOrders || 0)}</td>
        <td class="p-4">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${
            isDeleted
              ? 'bg-red-950/60 text-red-300 border-red-500/30'
              : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
          }">
            ${isDeleted ? 'Deleted' : 'Active'}
          </span>
        </td>
        <td class="p-4 text-right">
          <div class="flex items-center justify-end gap-2">
            <button onclick="viewAdminCustomer('${escHtml(u.userId)}')" class="px-3 py-1.5 rounded-lg bg-[#1B222C] hover:bg-[#252E3B] text-neutral-200 hover:text-amber-300 transition-colors" title="View Customer Profile & Orders">
              View
            </button>
            <button onclick="openCustomerDeleteModal('${escHtml(u.userId)}')" class="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-500/30 transition-colors" title="Delete Customer Account">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function customerOrdersFor(user) {
  const email = String(user.email || '').toLowerCase();
  return adminOrders.filter(o => {
    if (user.userId && o.userId === user.userId) return true;
    return Boolean(email) && String(o.customerEmail || '').toLowerCase() === email;
  });
}

function viewAdminCustomer(userId) {
  const user = adminUsers.find(u => u.userId === userId);
  if (!user) {
    showToast('Customer account not found. Refresh the list and try again.', 'error');
    return;
  }

  const orders = customerOrdersFor(user);
  const title = document.getElementById('customer-view-title');
  const body = document.getElementById('customer-view-body');
  if (title) title.textContent = `${user.name || user.email || 'Customer'} — Profile`;
  if (!body) return;

  const field = (label, value) => `
    <div>
      <p class="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">${escHtml(label)}</p>
      <p class="text-white font-semibold mt-0.5 break-words">${escHtml(value === '' || value == null ? '—' : value)}</p>
    </div>
  `;

  const savedAddress = [user.address, user.landmark, user.city, user.state, user.pincode].filter(Boolean).join(', ');

  const ordersBlock = orders.length === 0
    ? `<p class="text-neutral-500">No orders recorded for this customer yet.</p>`
    : orders.map(o => `
        <div class="p-3 rounded-xl bg-[#0B0E13] border border-[#1F2632] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div class="min-w-0">
            <span class="font-mono font-bold text-amber-400">#${escHtml(o.orderId)}</span>
            <p class="text-neutral-400 mt-0.5 break-words">${escHtml((o.items || []).map(i => `${i.brand} ${i.model} (×${i.quantity || 1})`).join(', ') || 'No item details')}</p>
            <p class="text-neutral-500 text-[10px]">${escHtml(fmtAdminDate(o.createdAt))} • ${escHtml(o.city || '')}</p>
          </div>
          <div class="flex items-center gap-3 flex-shrink-0">
            <span class="px-2 py-0.5 rounded bg-[#1B222C] text-neutral-300 text-[10px] font-bold">${escHtml(o.status || 'Pending')}</span>
            <span class="font-mono font-extrabold text-white">₹${escHtml(Number(o.total || 0).toLocaleString('en-IN'))}</span>
          </div>
        </div>
      `).join('');

  body.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${field('Name', user.name)}
      ${field('Email', user.email)}
      ${field('Phone', user.phone)}
      ${field('Account ID', user.userId)}
      ${field('Registered', fmtAdminDate(user.createdAt))}
      ${field('Last Login', fmtAdminDateTime(user.lastLogin))}
      ${field('Account Status', user.status || 'Active')}
      ${field('Deleted On', user.deletedAt ? fmtAdminDateTime(user.deletedAt) : '')}
      ${field('AM Coins Balance', `🪙 ${user.coinBalance || 0}`)}
      ${field('Total Orders', user.totalOrders || 0)}
      ${field('Total Spent', `₹${Number(user.totalSpent || 0).toLocaleString('en-IN')}`)}
      ${field('Saved Address', savedAddress)}
    </div>
    <div class="space-y-3 pt-2 border-t border-[#1F2632]">
      <p class="font-heading text-sm font-bold text-white tracking-wide">Order History (${orders.length})</p>
      <div class="space-y-2.5">${ordersBlock}</div>
    </div>
  `;

  const modal = document.getElementById('customer-view-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeCustomerViewModal() {
  const modal = document.getElementById('customer-view-modal');
  if (modal) modal.classList.add('hidden');
}

let pendingCustomerDeleteId = null;

function openCustomerDeleteModal(userId) {
  const user = adminUsers.find(u => u.userId === userId);
  if (!user) {
    showToast('Customer account not found. Refresh the list and try again.', 'error');
    return;
  }
  pendingCustomerDeleteId = userId;
  const detail = document.getElementById('customer-delete-detail');
  if (detail) {
    const orders = customerOrdersFor(user);
    detail.textContent = orders.length > 0
      ? `${user.name || user.email} has ${orders.length} order(s) — the account will be deactivated and the history kept.`
      : `${user.name || user.email} has no orders — the account will be removed permanently.`;
  }
  const modal = document.getElementById('customer-delete-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeCustomerDeleteModal() {
  pendingCustomerDeleteId = null;
  const modal = document.getElementById('customer-delete-modal');
  if (modal) modal.classList.add('hidden');
}

async function confirmCustomerDelete() {
  const userId = pendingCustomerDeleteId;
  if (!userId) return;

  const confirmBtn = document.getElementById('customer-delete-confirm-btn');
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: adminHeaders(false)
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      closeCustomerDeleteModal();
      await loadAdminUsers();
      showToast(data.message || 'Customer account removed.', 'success');
    } else {
      showToast(data.error || 'Failed to delete customer account', 'error');
      if (confirmBtn) confirmBtn.disabled = false;
    }
  } catch (e) {
    showToast('Network error deleting customer account', 'error');
    if (confirmBtn) confirmBtn.disabled = false;
  }
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
      headers: adminHeaders(),
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
    const res = await fetch(`/api/coupons/${code}`, { method: 'DELETE', headers: adminHeaders(false) });
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

  ['watches', 'orders', 'customers', 'branding', 'coupons', 'about'].forEach(t => {
    const sec = document.getElementById(`admin-tab-${t}`);
    if (sec) {
      if (t === tab) sec.classList.remove('hidden');
      else sec.classList.add('hidden');
    }
  });

  if (tab === 'about') loadAdminAbout();
}

// ===== ABOUT US CMS & CONTENT MANAGEMENT =====
let currentAboutTeam = [];

function setAboutPhotoPreview(key, url) {
  const preview = document.getElementById(`about-${key}-preview`);
  const placeholder = document.getElementById(`about-${key}-placeholder`);
  const removeBtn = document.getElementById(`about-${key}-remove`);
  if (!preview || !placeholder) return;
  if (url) {
    preview.src = url;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    if (removeBtn) removeBtn.classList.remove('hidden');
  } else {
    preview.src = '';
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    if (removeBtn) removeBtn.classList.add('hidden');
  }
}

function renderTeamMembersList() {
  const container = document.getElementById('about-team-members-container');
  if (!container) return;

  if (currentAboutTeam.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-8 text-center bg-[#0B0E13] rounded-2xl border border-[#1F2632] p-6 text-neutral-400">
        <p class="text-xs font-semibold">No team members added yet.</p>
        <button type="button" onclick="addNewTeamMember()" class="mt-3 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold uppercase tracking-wider transition-colors">
          + Add First Team Member
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = currentAboutTeam.map((m, idx) => {
    const key = m.key || `member_${idx}`;
    const initials = (m.name || 'TM').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'TM';
    return `
      <div class="p-5 rounded-3xl bg-[#0B0E13] border border-[#1F2632] space-y-4 relative group" data-team-index="${idx}">
        <div class="flex items-center justify-between border-b border-[#1F2632]/80 pb-3">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            <span class="font-heading text-xs font-bold text-amber-400 uppercase tracking-wider">${m.role || 'Team Member'}</span>
          </div>
          <div class="flex items-center gap-2">
            <label class="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-300 cursor-pointer">
              <input type="checkbox" onchange="updateTeamMemberField(${idx}, 'enabled', this.checked)" class="accent-amber-500 w-3.5 h-3.5" ${m.enabled !== false ? 'checked' : ''} />
              <span>Show</span>
            </label>
            <button type="button" onclick="deleteTeamMember(${idx})" class="p-1 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete Member">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </div>

        <!-- Photo & Basic Info -->
        <div class="flex items-center gap-4">
          <div class="relative w-20 h-20 rounded-2xl overflow-hidden border border-[#1F2632] bg-[#12161F] flex items-center justify-center flex-shrink-0">
            ${m.photoUrl 
              ? `<img src="${m.photoUrl}" alt="${m.name}" class="w-full h-full object-cover object-top" id="team-photo-preview-${idx}" />`
              : `<div class="font-heading text-xl font-bold text-amber-500" id="team-photo-placeholder-${idx}">${initials}</div>`
            }
          </div>
          <div class="flex-1 space-y-1.5">
            <div class="flex items-center gap-2">
              <button type="button" onclick="document.getElementById('team-file-input-${idx}').click()" class="px-2.5 py-1 rounded-lg bg-[#1B222C] hover:bg-[#252E3B] text-neutral-200 text-[10px] font-bold uppercase tracking-wider transition-colors">
                Photo
              </button>
              ${m.photoUrl ? `
                <button type="button" onclick="removeTeamMemberPhoto(${idx})" class="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider transition-colors">
                  Remove
                </button>
              ` : ''}
            </div>
            <input type="file" id="team-file-input-${idx}" accept="image/jpeg,image/jpg,image/png,image/webp" class="hidden" onchange="handleTeamMemberPhoto(${idx}, this)" />
            <div class="flex items-center gap-2 pt-1 text-[11px] text-neutral-400">
              <span>Order:</span>
              <input type="number" min="1" max="50" value="${m.order || (idx + 1)}" onchange="updateTeamMemberField(${idx}, 'order', parseInt(this.value, 10) || 1)" class="w-14 bg-[#12161F] border border-[#1F2632] rounded-lg px-2 py-0.5 text-white text-center text-xs" />
            </div>
          </div>
        </div>

        <!-- Fields -->
        <div class="space-y-2.5 pt-1">
          <div>
            <label class="block font-semibold text-neutral-400 text-[10px] uppercase mb-0.5">Name</label>
            <input type="text" value="${m.name || ''}" oninput="updateTeamMemberField(${idx}, 'name', this.value)" maxlength="120" class="w-full bg-[#12161F] border border-[#1F2632] rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500" placeholder="Full Name" />
          </div>
          <div>
            <label class="block font-semibold text-neutral-400 text-[10px] uppercase mb-0.5">Role / Position</label>
            <input type="text" value="${m.role || ''}" oninput="updateTeamMemberField(${idx}, 'role', this.value)" maxlength="120" class="w-full bg-[#12161F] border border-[#1F2632] rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500" placeholder="e.g. Lead Horologist" />
          </div>
          <div>
            <label class="block font-semibold text-neutral-400 text-[10px] uppercase mb-0.5">Bio</label>
            <textarea rows="2" oninput="updateTeamMemberField(${idx}, 'bio', this.value)" maxlength="1000" class="w-full bg-[#12161F] border border-[#1F2632] rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500 leading-relaxed" placeholder="Short biography…">${m.bio || ''}</textarea>
          </div>
          
          <div class="grid grid-cols-2 gap-2 pt-1">
            <input type="text" value="${(m.social && m.social.instagram) || ''}" oninput="updateTeamMemberSocial(${idx}, 'instagram', this.value)" maxlength="300" class="bg-[#12161F] border border-[#1F2632] rounded-lg px-2.5 py-1 text-white text-[10px] focus:outline-none focus:border-amber-500" placeholder="Instagram URL" />
            <input type="text" value="${(m.social && m.social.twitter) || ''}" oninput="updateTeamMemberSocial(${idx}, 'twitter', this.value)" maxlength="300" class="bg-[#12161F] border border-[#1F2632] rounded-lg px-2.5 py-1 text-white text-[10px] focus:outline-none focus:border-amber-500" placeholder="X / Twitter" />
            <input type="text" value="${(m.social && m.social.linkedin) || ''}" oninput="updateTeamMemberSocial(${idx}, 'linkedin', this.value)" maxlength="300" class="bg-[#12161F] border border-[#1F2632] rounded-lg px-2.5 py-1 text-white text-[10px] focus:outline-none focus:border-amber-500" placeholder="LinkedIn" />
            <input type="email" value="${(m.social && m.social.email) || ''}" oninput="updateTeamMemberSocial(${idx}, 'email', this.value)" maxlength="300" class="bg-[#12161F] border border-[#1F2632] rounded-lg px-2.5 py-1 text-white text-[10px] focus:outline-none focus:border-amber-500" placeholder="Email" />
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function addNewTeamMember() {
  const newIndex = currentAboutTeam.length + 1;
  currentAboutTeam.push({
    key: `member_${Date.now()}`,
    name: 'New Member',
    role: 'Watch Specialist',
    bio: 'Dedicated to luxury timepiece inspection, finishing, and customer satisfaction.',
    photoUrl: '',
    enabled: true,
    order: newIndex,
    social: { instagram: '', twitter: '', linkedin: '', email: '' }
  });
  renderTeamMembersList();
  showToast('New team member card added! Fill in details and click Save Changes.', 'info');
}

function deleteTeamMember(idx) {
  const memberName = currentAboutTeam[idx]?.name || 'this team member';
  if (!confirm(`Are you sure you want to delete ${memberName}?`)) return;
  currentAboutTeam.splice(idx, 1);
  renderTeamMembersList();
  showToast('Team member removed. Click Save Changes to publish.', 'info');
}

function updateTeamMemberField(idx, field, value) {
  if (currentAboutTeam[idx]) {
    currentAboutTeam[idx][field] = value;
  }
}

function updateTeamMemberSocial(idx, socialField, value) {
  if (currentAboutTeam[idx]) {
    if (!currentAboutTeam[idx].social) currentAboutTeam[idx].social = {};
    currentAboutTeam[idx].social[socialField] = value;
  }
}

async function handleTeamMemberPhoto(idx, input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('photo', file);

  try {
    showToast('Uploading team photo...', 'info');
    const res = await fetch('/api/about/photo', {
      method: 'POST',
      headers: adminHeaders(false),
      body: formData
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (currentAboutTeam[idx]) {
        currentAboutTeam[idx].photoUrl = data.photoUrl;
      }
      renderTeamMembersList();
      showToast('Photo uploaded! Click "Save Changes" to publish.', 'success');
    } else {
      showToast(data.error || 'Photo upload failed', 'error');
    }
  } catch (e) {
    showToast('Photo upload error', 'error');
  } finally {
    input.value = '';
  }
}

function removeTeamMemberPhoto(idx) {
  if (currentAboutTeam[idx]) {
    currentAboutTeam[idx].photoUrl = '';
    renderTeamMembersList();
    showToast('Photo removed. Click Save Changes to publish.', 'info');
  }
}

function fillAboutForm(about) {
  if (!about) return;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v == null ? '' : v; };
  const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v !== false; };

  // 1. General Content
  setVal('about-page-title', about.pageTitle || 'About sabrXwatches');
  setVal('about-intro', about.intro || '');
  setVal('about-story', about.story || '');
  setVal('about-mission', about.mission || '');
  setVal('about-vision', about.vision || '');
  setVal('about-values', about.values || 'Precision Craftsmanship • Absolute Transparency • Collector-Grade 1:1 Perfection • Pan-India Doorstep Trust');
  setVal('about-quality', about.quality || '');

  // 2. Founder / Owner Profile
  const owner = about.owner || (Array.isArray(about.team) ? about.team.find(t => t.key === 'founder' || t.role?.includes('Founder')) : null) || {};
  setChk('about-founder-enabled', owner.enabled !== false);
  setVal('about-founder-name', owner.name || 'Founder Name');
  setVal('about-founder-role', owner.role || 'Founder & CEO');
  setVal('about-founder-bio', owner.bio || '');
  setVal('about-founder-longbio', owner.longBio || '');
  setVal('about-founder-photo', owner.photoUrl || '');
  setVal('about-founder-instagram', (owner.social && owner.social.instagram) || '');
  setVal('about-founder-twitter', (owner.social && owner.social.twitter) || '');
  setVal('about-founder-linkedin', (owner.social && owner.social.linkedin) || '');
  setVal('about-founder-email', (owner.social && owner.social.email) || '');
  setVal('about-founder-phone', (owner.social && owner.social.phone) || '');
  setAboutPhotoPreview('founder', owner.photoUrl || '');

  // 3. Dynamic Team Members
  currentAboutTeam = Array.isArray(about.team) ? JSON.parse(JSON.stringify(about.team)) : [];
  renderTeamMembersList();

  // 4. Section Visibility & Order
  (about.sections || []).forEach(s => {
    setChk(`about-sec-${s.key}`, s.enabled);
    setVal(`about-sec-order-${s.key}`, s.order);
  });

  // 5. Who Is Who
  (about.whoIsWho || []).forEach(w => {
    setChk(`about-who-${w.role}-enabled`, w.enabled);
    setVal(`about-who-${w.role}-title`, w.title);
    setVal(`about-who-${w.role}-desc`, w.description);
    setVal(`about-who-${w.role}-order`, w.order);
  });
}

async function loadAdminAbout(manual = false) {
  try {
    const res = await fetch('/api/about', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (!res.ok) throw new Error('status ' + res.status);
    const about = await res.json();
    fillAboutForm(about);
    if (manual) showToast('About Us content loaded from MongoDB Atlas! 💎', 'success');
  } catch (e) {
    showToast('Could not load About Us content from MongoDB Atlas.', 'error');
  }
}

async function handleAboutPhoto(key, input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('photo', file);

  try {
    showToast('Uploading founder photo...', 'info');
    const res = await fetch('/api/about/photo', {
      method: 'POST',
      headers: adminHeaders(false),
      body: formData
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const hidden = document.getElementById(`about-${key}-photo`);
      if (hidden) hidden.value = data.photoUrl;
      setAboutPhotoPreview(key, data.photoUrl);
      showToast('Photo uploaded! Click "Save Changes" to publish.', 'success');
    } else {
      showToast(data.error || 'Photo upload failed', 'error');
    }
  } catch (e) {
    showToast('Photo upload error', 'error');
  } finally {
    input.value = '';
  }
}

function removeAboutPhoto(key) {
  const hidden = document.getElementById(`about-${key}-photo`);
  if (hidden) hidden.value = '';
  setAboutPhotoPreview(key, '');
  showToast('Photo removed. Click "Save Changes" to publish.', 'info');
}

async function handleAboutSubmit(e) {
  if (e) e.preventDefault();
  const getVal = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const getChk = id => { const el = document.getElementById(id); return el ? el.checked : true; };
  const getNum = id => { const el = document.getElementById(id); const n = parseInt(el && el.value, 10); return Number.isFinite(n) ? n : 0; };

  const sectionKeys = ['intro', 'story', 'mission', 'values', 'owner', 'team', 'quality', 'whoIsWho'];
  const sectionLabels = {
    intro: 'Brand Introduction',
    story: 'Our Story',
    mission: 'Mission & Vision',
    values: 'Core Values',
    owner: 'Founder Profile',
    team: 'Meet The Team',
    quality: 'Quality Standard',
    whoIsWho: 'Who Is Who'
  };

  const owner = {
    name: getVal('about-founder-name'),
    role: getVal('about-founder-role'),
    bio: getVal('about-founder-bio'),
    longBio: getVal('about-founder-longbio'),
    photoUrl: getVal('about-founder-photo'),
    enabled: getChk('about-founder-enabled'),
    social: {
      instagram: getVal('about-founder-instagram'),
      twitter: getVal('about-founder-twitter'),
      linkedin: getVal('about-founder-linkedin'),
      email: getVal('about-founder-email'),
      phone: getVal('about-founder-phone')
    }
  };

  const whoRoles = ['founder', 'developer', 'manager'];
  const whoIsWho = whoRoles.map((k, i) => ({
    role: k,
    title: getVal(`about-who-${k}-title`),
    description: getVal(`about-who-${k}-desc`),
    enabled: getChk(`about-who-${k}-enabled`),
    order: getNum(`about-who-${k}-order`) || (i + 1)
  }));

  const payload = {
    pageTitle: getVal('about-page-title'),
    intro: getVal('about-intro'),
    story: getVal('about-story'),
    mission: getVal('about-mission'),
    vision: getVal('about-vision'),
    values: getVal('about-values'),
    quality: getVal('about-quality'),
    owner,
    sections: sectionKeys.map((k, idx) => ({
      key: k,
      label: sectionLabels[k],
      enabled: getChk(`about-sec-${k}`),
      order: getNum(`about-sec-order-${k}`) || (idx + 1)
    })),
    team: currentAboutTeam.map((m, idx) => ({
      ...m,
      order: Number(m.order) || (idx + 1)
    })),
    whoIsWho
  };

  try {
    showToast('Saving About Us changes to MongoDB Atlas...', 'info');
    const res = await fetch('/api/about', {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('About Us published successfully to MongoDB Atlas! ✅', 'success');
      if (data.about) fillAboutForm(data.about);
    } else {
      showToast(data.error || 'Failed to save About Us', 'error');
    }
  } catch (e) {
    showToast('Network error saving About Us to database', 'error');
  }
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 transform translate-y-2 opacity-0 text-sm font-medium ${
    type === 'success' 
      ? 'bg-[#12161F]/95 border-amber-500/50 text-amber-200' 
      : type === 'error' 
      ? 'bg-[#12161F]/95 border-red-500/50 text-red-200' 
      : 'bg-[#12161F]/95 border-[#2A3342] text-neutral-200'
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
