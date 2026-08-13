/**
 * Averroes Restaurant - Admin Dashboard
 * Single-page dashboard for menu, orders and settings management.
 */
(function () {
  'use strict';

  let currentTab = 'dashboard';
  let editingMealId = null;
  let pendingImage = null;
  let currentChatId = null;
  let chatPollTimer = null;
  let lastMessageCount = 0;
  let lastAdminUnread = 0;
  let adminBadgeInitialized = false;
  let notificationAudio = null;
  let notificationEnabled = true;

  const dom = {};

  const TAB_MAP = {
    dashboard: { label: 'Dashboard', icon: 'fa-chart-pie' },
    menu: { label: 'Menu', icon: 'fa-utensils' },
    orders: { label: 'Orders', icon: 'fa-receipt' },
    chats: { label: 'Chats', icon: 'fa-comments' },
    settings: { label: 'Settings', icon: 'fa-gear' }
  };

  function formatMoney(amount) {
    const settings = AverroesDB.getSettings();
    return settings.currency + (amount || 0).toLocaleString(settings.locale);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function toast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2500);
  }

  function cacheDom() {
    dom.loginView = document.getElementById('login-view');
    dom.appView = document.getElementById('admin-app');
    dom.loginForm = document.getElementById('login-form');
    dom.sidebar = document.getElementById('admin-sidebar');
    dom.content = document.getElementById('admin-content');
    dom.chatTotalBadge = document.getElementById('chat-total-badge');
    dom.dashboardTotalMeals = document.getElementById('dash-total-meals');
    dom.dashboardTotalOrders = document.getElementById('dash-total-orders');
    dom.dashboardRevenue = document.getElementById('dash-revenue');
    dom.dashboardLowStock = document.getElementById('dash-low-stock');
    dom.ordersTable = document.getElementById('orders-table-body');
    dom.mealModal = document.getElementById('meal-modal');
    dom.settingsForm = document.getElementById('settings-form');
  }

  function toggleViews() {
    if (AverroesDB.isLoggedIn()) {
      dom.loginView.classList.add('hidden');
      dom.appView.classList.remove('hidden');
      renderTab(currentTab);
    } else {
      dom.loginView.classList.remove('hidden');
      dom.appView.classList.add('hidden');
    }
  }

  function switchTab(tab) {
    currentTab = tab;
    dom.sidebar.querySelectorAll('a').forEach(a => {
      a.classList.toggle('active', a.dataset.tab === tab);
    });
    renderTab(tab);
  }

  function renderTab(tab) {
    const title = TAB_MAP[tab].label;
    const icon = TAB_MAP[tab].icon;
    let html = `<h1 class="font-serif text-3xl font-bold text-zinc-900 mb-6"><i class="fa-solid ${icon} text-brand-gold mr-3"></i>${title}</h1>`;

    if (tab === 'dashboard') {
      html += renderDashboardHtml();
    } else if (tab === 'menu') {
      html += renderMenuHtml();
    } else if (tab === 'orders') {
      html += renderOrdersHtml();
    } else if (tab === 'chats') {
      html += renderChatsHtml();
    } else if (tab === 'settings') {
      html += renderSettingsHtml();
    }

    dom.content.innerHTML = html;
    attachTabListeners(tab);
  }

  function renderDashboardHtml() {
    const meals = AverroesDB.getMeals();
    const orders = AverroesDB.getOrders();
    const expenses = AverroesDB.getExpenses();
    const transactions = AverroesDB.getTransactions();
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    
    const confirmedOrders = orders.filter(o => o.status === 'CONFIRMED' || o.status === 'COMPLETED');
    const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'NEW');
    const currentMonthOrders = orders.filter(o => (o.monthKey || o.createdAt.slice(0, 7)) === currentMonth);
    
    const totalRevenue = confirmedOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    
    const currentMonthConfirmedOrders = currentMonthOrders.filter(o => o.status === 'CONFIRMED' || o.status === 'COMPLETED');
    const currentMonthRevenue = currentMonthConfirmedOrders.reduce((s, o) => s + (o.total || 0), 0);
    
    const lowStock = meals.filter(m => m.outOfStock).length;
    
    return `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div class="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <p class="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Total Revenue</p>
          <p class="font-serif text-3xl font-bold text-brand-gold mt-2">${formatMoney(totalRevenue)}</p>
          <p class="text-[10px] text-zinc-400 mt-1">${confirmedOrders.length} confirmed orders</p>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <p class="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Total Expenses</p>
          <p class="font-serif text-3xl font-bold text-red-600 mt-2">${formatMoney(totalExpenses)}</p>
          <p class="text-[10px] text-zinc-400 mt-1">${expenses.length} expense records</p>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <p class="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Net Profit</p>
          <p class="font-serif text-3xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'} mt-2">${formatMoney(netProfit)}</p>
          <p class="text-[10px] text-zinc-400 mt-1">Revenue - Expenses</p>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <p class="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Pending Orders</p>
          <p class="font-serif text-3xl font-bold text-amber-600 mt-2">${pendingOrders.length}</p>
          <p class="text-[10px] text-zinc-400 mt-1">Awaiting confirmation</p>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <p class="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Month Revenue</p>
          <p class="font-serif text-3xl font-bold text-brand-gold mt-2">${formatMoney(currentMonthRevenue)}</p>
          <p class="text-[10px] text-zinc-400 mt-1">${currentMonthConfirmedOrders.length} orders this month</p>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <p class="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Total Orders</p>
          <p class="font-serif text-3xl font-bold text-zinc-900 mt-2">${orders.length}</p>
          <p class="text-[10px] text-zinc-400 mt-1">All time</p>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <p class="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Transactions</p>
          <p class="font-serif text-3xl font-bold text-blue-600 mt-2">${transactions.length}</p>
          <p class="text-[10px] text-zinc-400 mt-1">Total recorded</p>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <p class="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Out of Stock</p>
          <p class="font-serif text-3xl font-bold text-red-600 mt-2">${lowStock}</p>
          <p class="text-[10px] text-zinc-400 mt-1">Menu items</p>
        </div>
      </div>
      <div class="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <h2 class="font-serif text-xl font-bold text-zinc-900 mb-4">Quick Links</h2>
        <div class="flex flex-wrap gap-3">
          <button data-goto="menu" class="goto-btn px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800">Manage Menu</button>
          <button data-goto="orders" class="goto-btn px-4 py-2 bg-brand-gold text-zinc-900 rounded-lg text-sm font-semibold hover:bg-[#B89A50]">View Orders</button>
          <button data-goto="chats" class="goto-btn px-4 py-2 bg-white border border-zinc-300 text-zinc-800 rounded-lg text-sm font-semibold hover:border-brand-gold">Chats</button>
          <button data-goto="accounting" class="goto-btn px-4 py-2 bg-white border border-zinc-300 text-zinc-800 rounded-lg text-sm font-semibold hover:border-brand-gold">Accounting</button>
          <button data-goto="settings" class="goto-btn px-4 py-2 bg-white border border-zinc-300 text-zinc-800 rounded-lg text-sm font-semibold hover:border-brand-gold">Settings</button>
        </div>
      </div>
    `;
  }

  function renderMenuHtml() {
    return `
      <div class="space-y-5">
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div class="relative w-full sm:max-w-sm">
            <i class="fa-solid fa-magnifying-glass absolute inset-y-0 left-3 flex items-center text-zinc-400 text-sm"></i>
            <input type="text" id="menu-search" placeholder="Search by name or category..." class="w-full pl-9 pr-4 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none">
          </div>
          <div class="flex items-center gap-2">
            <button id="add-category-btn" class="px-4 py-2.5 bg-white border border-zinc-300 text-zinc-800 rounded-lg text-sm font-semibold hover:border-brand-gold flex items-center gap-2 shrink-0">
              <i class="fa-solid fa-folder-plus text-xs"></i> Add Category
            </button>
            <button id="add-meal-btn" class="px-4 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 flex items-center gap-2 shrink-0">
              <i class="fa-solid fa-plus text-xs"></i> Add Meal
            </button>
          </div>
        </div>

        <div class="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Categories</h3>
          <div id="category-list" class="flex flex-wrap gap-2"></div>
        </div>

        <div id="menu-list" class="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden"></div>
      </div>
    `;
  }

  function renderCategoriesList() {
    const categories = AverroesDB.getCategories().slice().sort((a, b) => a.order - b.order);
    const meals = AverroesDB.getMeals();
    const list = document.getElementById('category-list');
    if (!list) return;

    list.innerHTML = categories.map(c => {
      const count = meals.filter(m => m.categoryId === c.id).length;
      return `
        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-200 bg-zinc-50 text-sm" data-id="${c.id}">
          <span class="font-medium text-zinc-800">${escapeHtml(c.title)}</span>
          <span class="text-[10px] text-zinc-500">${count}</span>
          <button data-cat-edit="${c.id}" class="w-6 h-6 rounded-full hover:bg-zinc-200 text-zinc-500 flex items-center justify-center" aria-label="Rename"><i class="fa-solid fa-pen text-[10px]"></i></button>
          <button data-cat-delete="${c.id}" class="w-6 h-6 rounded-full hover:bg-red-100 text-zinc-500 hover:text-red-600 flex items-center justify-center" aria-label="Delete"><i class="fa-solid fa-xmark text-[10px]"></i></button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', handleCategoryAction);
    });
  }

  function handleCategoryAction(e) {
    const btn = e.currentTarget;
    const id = btn.dataset.catEdit || btn.dataset.catDelete;
    const cat = AverroesDB.getCategoryById(id);
    if (!cat) return;

    if (btn.dataset.catEdit) {
      const title = prompt('Rename category:', cat.title);
      if (title && title.trim()) {
        AverroesDB.updateCategory(id, { title: title.trim() });
        renderCategoriesList();
        renderMenuList(dom.menuSearch?.value || '');
        toast('Category renamed');
      }
    } else if (btn.dataset.catDelete) {
      const mealsInCat = AverroesDB.getMeals().filter(m => m.categoryId === id);
      if (mealsInCat.length > 0) {
        toast('Cannot delete: move or delete meals first');
        return;
      }
      if (confirm(`Delete category "${cat.title}"?`)) {
        AverroesDB.deleteCategory(id);
        renderCategoriesList();
        renderMenuList(dom.menuSearch?.value || '');
        toast('Category deleted');
      }
    }
  }

  function mealImageThumb(meal, dim) {
    const dimClass = dim ? ' blur-[1px] grayscale opacity-70' : '';
    if (meal.image) {
      return `<img src="${escapeHtml(meal.image)}" alt="${escapeHtml(meal.name)}" class="h-full w-full object-cover${dimClass}" onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');"><div class="hidden absolute inset-0 bg-amber-100 flex items-center justify-center"><i class="fa-solid fa-utensils text-amber-500 text-xl"></i></div>`;
    }
    return `<div class="h-full w-full flex items-center justify-center"><i class="fa-solid fa-utensils text-amber-500 text-xl"></i></div>`;
  }

  function renderMenuList(query = '') {
    const meals = AverroesDB.getMeals().slice();
    const categories = AverroesDB.getCategories();
    const q = query.toLowerCase().trim();
    let filtered = q ? meals.filter(m => {
      const cat = categories.find(c => c.id === m.categoryId);
      return m.name.toLowerCase().includes(q) || (cat ? cat.title.toLowerCase().includes(q) : false);
    }) : meals;

    const list = document.getElementById('menu-list');
    if (!list) return;

    if (filtered.length === 0) {
      list.innerHTML = `<div class="p-8 text-center text-zinc-500">No meals found.</div>`;
      return;
    }

    const catOrder = {};
    categories.forEach((c, i) => { catOrder[c.id] = i; });
    filtered = filtered.sort((a, b) => {
      const aOrder = catOrder[a.categoryId] ?? Infinity;
      const bOrder = catOrder[b.categoryId] ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });

    list.innerHTML = filtered.map(m => {
      const cat = categories.find(c => c.id === m.categoryId) || { title: '—' };
      const unavailable = !m.available || m.outOfStock;
      const status = unavailable
        ? '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-red-100 text-red-700">Not Available</span>'
        : '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-green-100 text-green-700">Available</span>';
      return `
        <div class="flex items-start gap-4 p-4 border-b border-zinc-100 last:border-b-0 ${unavailable ? 'opacity-60' : ''}" data-id="${m.id}">
          <div class="relative h-16 w-16 rounded-2xl overflow-hidden bg-amber-100 border border-zinc-100 shrink-0">${mealImageThumb(m, unavailable)}</div>
          <div class="min-w-0 flex-1 pt-1">
            <h3 class="font-serif font-semibold text-base text-zinc-900 truncate">${escapeHtml(m.name)}</h3>
            <p class="text-xs text-zinc-500 mt-0.5">${escapeHtml(cat.title)}</p>
            <div class="mt-1.5">${status}</div>
          </div>
          <div class="shrink-0 flex flex-col items-end gap-2">
            <p class="text-red-600 font-extrabold text-xl leading-none">${formatMoney(m.price)}</p>
            <div class="flex items-center gap-2 mt-1">
              <button data-edit="${m.id}" class="px-2.5 py-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold" aria-label="Edit">Edit</button>
              <button data-price="${m.id}" class="px-2.5 py-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold" aria-label="Price">Price</button>
              <button data-availability="${m.id}" class="px-2.5 py-1.5 rounded ${unavailable ? 'bg-green-50 hover:bg-green-100 text-green-700' : 'bg-red-50 hover:bg-red-100 text-red-700'} text-xs font-semibold" aria-label="Availability">${unavailable ? 'Available' : 'Unavailable'}</button>
              <button data-delete="${m.id}" class="px-2.5 py-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold" aria-label="Delete">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', handleMenuAction);
    });
  }

  function handleMenuAction(e) {
    const btn = e.currentTarget;
    const id = btn.dataset.edit || btn.dataset.delete || btn.dataset.price || btn.dataset.availability;
    const meal = AverroesDB.getMealById(id);
    if (!meal) return;

    if (btn.dataset.edit) {
      openMealModal(meal);
    } else if (btn.dataset.price) {
      const newPrice = prompt(`New price for ${meal.name}:`, meal.price);
      if (newPrice !== null && !isNaN(parseFloat(newPrice))) {
        AverroesDB.updateMeal(id, { price: parseFloat(newPrice) });
        renderMenuList(dom.menuSearch?.value || '');
        toast('Price updated');
      }
    } else if (btn.dataset.availability) {
      const unavailable = !meal.available || meal.outOfStock;
      AverroesDB.updateMeal(id, { available: !unavailable, outOfStock: false });
      renderMenuList(dom.menuSearch?.value || '');
      toast(unavailable ? 'Marked available' : 'Marked unavailable');
    } else if (btn.dataset.delete && confirm(`Delete "${meal.name}"?`)) {
      AverroesDB.deleteMeal(id);
      renderMenuList(dom.menuSearch?.value || '');
      toast('Meal deleted');
    }
  }

  function openMealModal(meal = null) {
    editingMealId = meal ? meal.id : null;
    pendingImage = meal ? meal.image : null;
    const cats = AverroesDB.getCategories().sort((a, b) => a.order - b.order);
    const settings = AverroesDB.getSettings();
    const options = cats.map(c => `<option value="${c.id}" ${meal && meal.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.title)}</option>`).join('');

    const imagePreview = pendingImage
      ? `<img src="${escapeHtml(pendingImage)}" class="h-24 w-24 object-cover rounded-2xl border border-zinc-200">`
      : `<div class="h-24 w-24 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-500 border border-zinc-200"><i class="fa-solid fa-utensils text-2xl"></i></div>`;

    dom.mealModal.innerHTML = `
      <div class="fixed inset-0 z-[70] flex items-center justify-center p-4" id="meal-modal-wrapper">
        <div class="absolute inset-0 modal-overlay" id="close-meal-modal"></div>
        <div class="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
          <div class="flex items-center justify-between mb-5">
            <h2 class="font-serif text-2xl font-bold text-zinc-900">${editingMealId ? 'Edit Meal' : 'Add Meal'}</h2>
            <button id="close-meal-modal-icon" class="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form id="meal-form" class="space-y-4">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Meal Name</label>
              <input type="text" name="name" required value="${meal ? escapeHtml(meal.name) : ''}" class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm">
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Category</label>
                <select name="categoryId" required class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm">${options}</select>
              </div>
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Price (${settings.currency})</label>
                <input type="number" name="price" required min="0" value="${meal ? meal.price : ''}" class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm">
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Image</label>
              <div class="flex items-center gap-4">
                <div id="meal-image-preview">${imagePreview}</div>
                <label class="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-zinc-800">
                  Upload Image
                  <input type="file" id="meal-image-input" accept="image/*" class="hidden">
                </label>
              </div>
            </div>
            <div>
              <label class="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" name="available" ${!meal || meal.available ? 'checked' : ''} class="accent-brand-gold h-4 w-4">
                Available
              </label>
            </div>
            <div class="flex justify-end gap-3 pt-4 border-t border-zinc-100">
              <button type="button" id="cancel-meal" class="px-5 py-2.5 bg-zinc-100 text-zinc-800 rounded-lg text-sm font-semibold hover:bg-zinc-200">Cancel</button>
              <button type="submit" class="px-5 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800">Save Meal</button>
            </div>
          </form>
        </div>
      </div>
    `;

    dom.mealModal.classList.remove('hidden');
    dom.mealModal.querySelector('#close-meal-modal').addEventListener('click', closeMealModal);
    dom.mealModal.querySelector('#close-meal-modal-icon').addEventListener('click', closeMealModal);
    dom.mealModal.querySelector('#cancel-meal').addEventListener('click', closeMealModal);
    dom.mealModal.querySelector('#meal-form').addEventListener('submit', saveMeal);
    dom.mealModal.querySelector('#meal-image-input').addEventListener('change', handleImageUpload);
  }

  function closeMealModal() {
    dom.mealModal.classList.add('hidden');
    dom.mealModal.innerHTML = '';
    editingMealId = null;
    pendingImage = null;
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      pendingImage = ev.target.result;
      const preview = document.getElementById('meal-image-preview');
      if (preview) preview.innerHTML = `<img src="${pendingImage}" class="h-24 w-24 object-cover rounded-2xl border border-zinc-200">`;
    };
    reader.readAsDataURL(file);
  }

  function saveMeal(e) {
    e.preventDefault();
    const form = e.target;
    const base = {
      name: form.name.value.trim(),
      categoryId: form.categoryId.value,
      price: parseFloat(form.price.value) || 0,
      image: pendingImage,
      available: form.available.checked,
      outOfStock: false
    };

    if (editingMealId) {
      AverroesDB.updateMeal(editingMealId, base);
      toast('Meal updated');
    } else {
      AverroesDB.addMeal({
        ...base,
        outOfStock: false,
        hidden: false,
        description: '',
        prepTime: '',
        isChefSpecial: false,
        isPopular: false,
        isTodaysSpecial: false,
        isChefRecommendation: false,
        mealTypes: [],
        tags: []
      });
      toast('Meal added');
    }
    closeMealModal();
    renderMenuList(dom.menuSearch?.value || '');
    renderCategoriesList();
  }

  function renderOrdersHtml() {
    const orders = AverroesDB.getOrders();
    const years = Array.from(new Set(orders.map(o => new Date(o.createdAt).getFullYear()).filter(y => !isNaN(y)))).sort((a, b) => b - a);
    const yearOptions = ['<option value="" selected>All years</option>', ...years.map(y => `<option value="${y}">${y}</option>`)].join('');
    const monthNames = ['All months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthOptions = monthNames.map((m, i) => `<option value="${i}" ${i === 0 ? 'selected' : ''}>${m}</option>`).join('');
    const statusOptions = ['All statuses', 'Active', 'PENDING', 'NEW', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((s, i) => `<option value="${s}" ${i === 0 ? 'selected' : ''}>${s}</option>`).join('');
    return `
      <div class="space-y-5">
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
            <div>
              <h2 class="font-serif text-xl font-bold text-zinc-900">Order History</h2>
              <p class="text-sm text-zinc-500 mt-1">Filter by year, month and status. Records are kept permanently.</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <select id="order-year-filter" class="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white">${yearOptions}</select>
              <select id="order-month-filter" class="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white">${monthOptions}</select>
              <select id="order-status-filter" class="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white">${statusOptions}</select>
              <button id="show-current-orders" class="px-3 py-2.5 bg-zinc-100 text-zinc-800 rounded-lg text-sm font-semibold hover:bg-zinc-200">Current</button>
              <button id="show-all-history" class="px-3 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800">All</button>
              <button id="print-statement" class="px-4 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 flex items-center gap-2 shrink-0">
                <i class="fa-solid fa-print text-xs"></i> Print
              </button>
            </div>
          </div>
          <div id="month-summary" class="grid grid-cols-2 sm:grid-cols-4 gap-3"></div>
        </div>
        <div id="orders-list" class="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden"></div>
      </div>
    `;
  }

  function getOrderFilters() {
    const yearEl = document.getElementById('order-year-filter');
    const monthEl = document.getElementById('order-month-filter');
    const statusEl = document.getElementById('order-status-filter');
    return {
      year: yearEl ? yearEl.value : '',
      month: monthEl ? monthEl.value : '0',
      status: statusEl ? statusEl.value : 'All statuses'
    };
  }

  function filterOrders() {
    const { year, month, status } = getOrderFilters();
    return AverroesDB.getOrders().filter(o => {
      const d = new Date(o.createdAt);
      if (year && d.getFullYear() !== parseInt(year)) return false;
      if (month && parseInt(month) !== 0 && d.getMonth() + 1 !== parseInt(month)) return false;
      if (status && status !== 'All statuses' && status !== 'Active') {
        if (o.status !== status) return false;
      }
      if (status === 'Active') {
        return ['PENDING', 'NEW', 'CONFIRMED'].includes(o.status);
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function renderFilteredOrders() {
    const orders = filterOrders();
    const list = document.getElementById('orders-list');
    if (!list) return;
    const statusClass = {
      PENDING: 'bg-amber-100 text-amber-800',
      NEW: 'bg-amber-100 text-amber-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-red-100 text-red-700'
    };
    list.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-zinc-100 text-zinc-600 text-xs uppercase tracking-wider font-semibold">
            <tr>
              <th class="px-4 py-3">Order #</th>
              <th class="px-4 py-3">Date & Time</th>
              <th class="px-4 py-3">Location</th>
              <th class="px-4 py-3">Items</th>
              <th class="px-4 py-3">Total</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>${orders.length ? orders.map(o => {
            const itemCount = (o.items || []).reduce((a, i) => a + (i.qty || 0), 0);
            const sClass = statusClass[o.status] || 'bg-zinc-100 text-zinc-600';
            const date = new Date(o.createdAt);
            const isManager = AverroesDB.isManager();
            return `
              <tr class="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                <td class="px-4 py-3 font-medium text-zinc-900">${o.orderNumber}</td>
                <td class="px-4 py-3 text-zinc-600 text-xs whitespace-nowrap">${date.toLocaleDateString()}<br>${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td class="px-4 py-3 text-zinc-600">${escapeHtml(o.location)}${o.identifier ? ' • ' + escapeHtml(o.identifier) : ''}</td>
                <td class="px-4 py-3 text-zinc-600">${itemCount}</td>
                <td class="px-4 py-3 font-semibold text-zinc-900">${formatMoney(o.total)}</td>
                <td class="px-4 py-3">
                  <select data-status-order="${o.id}" class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border-0 ${sClass}">
                    <option value="PENDING" ${o.status === 'PENDING' || o.status === 'NEW' ? 'selected' : ''}>PENDING</option>
                    <option value="CONFIRMED" ${o.status === 'CONFIRMED' || o.status === 'ATTENDED' ? 'selected' : ''}>CONFIRMED</option>
                    <option value="COMPLETED" ${o.status === 'COMPLETED' || o.status === 'CLEARED' ? 'selected' : ''}>COMPLETED</option>
                    ${isManager ? `<option value="CANCELLED" ${o.status === 'CANCELLED' ? 'selected' : ''}>CANCELLED</option>` : ''}
                  </select>
                </td>
                <td class="px-4 py-3 text-right">
                  <button data-view-order="${o.id}" class="w-8 h-8 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center" aria-label="View"><i class="fa-solid fa-eye text-xs"></i></button>
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="7" class="px-4 py-8 text-center text-zinc-500">No matching orders.</td></tr>'}</tbody>
        </table>
      </div>
    `;
    renderMonthSummary(orders);
    list.querySelectorAll('button[data-view-order]').forEach(btn => {
      btn.addEventListener('click', () => viewOrder(btn.dataset.viewOrder));
    });
    list.querySelectorAll('select[data-status-order]').forEach(select => {
      select.addEventListener('change', async () => {
        const result = await AverroesDB.adminUpdateOrderStatus(select.dataset.statusOrder, select.value);
        if (result.error) {
          toast('Unauthorized or failed');
        } else {
          toast('Status updated');
        }
        renderFilteredOrders();
      });
    });
  }

  /* Order status and view actions are now handled inline in renderFilteredOrders */

  async function viewOrder(id) {
    const order = AverroesDB.getOrders().find(o => o.id === id);
    if (!order) return;
    const date = new Date(order.createdAt);
    const isManager = AverroesDB.isManager();
    const items = (order.items || []).map(i => {
      const lineTotal = (i.price || 0) * (i.qty || 0);
      return `<div class="flex justify-between text-sm py-1 border-b border-zinc-100 last:border-0"><span>${i.qty}× ${escapeHtml(i.name)}</span><span class="font-semibold">${formatMoney(lineTotal)}</span></div>`;
    }).join('');
    dom.mealModal.innerHTML = `
      <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div class="absolute inset-0 modal-overlay" id="close-meal-modal"></div>
        <div class="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-5">
            <h2 class="font-serif text-2xl font-bold text-zinc-900">Order ${order.orderNumber}</h2>
            <button id="close-meal-modal-icon" class="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="space-y-4 text-sm">
            <p class="text-zinc-600"><strong>Location:</strong> ${escapeHtml(order.location)}${order.identifier ? ' • ' + escapeHtml(order.identifier) : ''}</p>
            <p class="text-zinc-600"><strong>Placed:</strong> ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <div class="bg-zinc-50 rounded-xl p-4">
              ${items || '<p class="text-zinc-500">No items</p>'}
            </div>
            <div class="space-y-2 border-t border-zinc-100 pt-3">
              <div class="flex justify-between text-zinc-900 font-bold text-base pt-2 border-t border-zinc-100"><span>Order Total</span><span class="text-brand-gold">${formatMoney(order.total)}</span></div>
            </div>
            ${isManager && order.status !== 'COMPLETED' ? `
            <div class="flex gap-2 pt-4 border-t border-zinc-100">
              <button data-admin-cancel-order="${order.id}" class="flex-1 px-4 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100">Cancel Order</button>
              <button data-admin-delete-order="${order.id}" class="flex-1 px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800">Delete Order</button>
            </div>` : ''}
          </div>
        </div>
      </div>
    `;
    dom.mealModal.classList.remove('hidden');
    dom.mealModal.querySelector('#close-meal-modal').addEventListener('click', closeMealModal);
    dom.mealModal.querySelector('#close-meal-modal-icon').addEventListener('click', closeMealModal);
    const cancelBtn = dom.mealModal.querySelector('[data-admin-cancel-order]');
    const deleteBtn = dom.mealModal.querySelector('[data-admin-delete-order]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        if (!confirm('Cancel this order?')) return;
        const res = await AverroesDB.adminCancelOrder(order.id);
        if (res.error) toast(res.error);
        else toast('Order cancelled');
        closeMealModal();
        renderFilteredOrders();
      });
    }
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Delete this order permanently? This action cannot be undone.')) return;
        const res = await AverroesDB.adminDeleteOrder(order.id);
        if (res.error) toast(res.error);
        else toast('Order deleted');
        closeMealModal();
        renderFilteredOrders();
      });
    }
  }

  function renderMonthSummary(orders) {
    const total = orders.reduce((s, o) => s + (o.total || 0), 0);
    const counts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});
    const el = document.getElementById('month-summary');
    if (!el) return;
    el.innerHTML = `
      <div class="bg-zinc-50 p-3 rounded-xl border border-zinc-200"><p class="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Total Orders</p><p class="font-serif text-2xl font-bold text-zinc-900 mt-1">${orders.length}</p></div>
      <div class="bg-zinc-50 p-3 rounded-xl border border-zinc-200"><p class="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Total Value</p><p class="font-serif text-2xl font-bold text-brand-gold mt-1">${formatMoney(total)}</p></div>
      <div class="bg-zinc-50 p-3 rounded-xl border border-zinc-200"><p class="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Completed</p><p class="font-serif text-2xl font-bold text-green-700 mt-1">${counts['COMPLETED'] || 0}</p></div>
      <div class="bg-zinc-50 p-3 rounded-xl border border-zinc-200"><p class="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Pending</p><p class="font-serif text-2xl font-bold text-amber-700 mt-1">${(counts['PENDING'] || 0) + (counts['NEW'] || 0)}</p></div>
    `;
  }

  function printStatement() {
    const orders = filterOrders();
    const settings = AverroesDB.getSettings();
    const { year, month, status } = getOrderFilters();
    const monthIndex = parseInt(month || 0);
    const monthLabel = monthIndex > 0 ? new Date(2000, monthIndex - 1, 1).toLocaleString('default', { month: 'long' }) : '';
    const titleParts = ['Order Statement'];
    if (year) titleParts.push(year);
    if (monthLabel) titleParts.push(monthLabel);
    if (status && status !== 'All statuses') titleParts.push(status);
    const title = titleParts.join(' - ');
    const total = orders.reduce((s, o) => s + (o.total || 0), 0);
    const rows = orders.map(o => {
      const items = (o.items || []).map(i => `${i.qty}× ${i.name}`).join(', ');
      const date = new Date(o.createdAt);
      return `<tr><td>${o.orderNumber}</td><td>${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td>${escapeHtml(o.location)}${o.identifier ? ' - ' + escapeHtml(o.identifier) : ''}</td><td>${escapeHtml(items)}</td><td>${formatMoney(o.total)}</td><td>${o.status}</td></tr>`;
    }).join('');
    const html = `
      <!DOCTYPE html><html><head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Inter, system-ui, sans-serif; color: #1a1a1a; padding: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #e5e5e5; padding: 10px; text-align: left; font-size: 13px; }
          th { background: #f5f5f5; }
          h1 { font-family: serif; margin: 0; }
          .header { margin-bottom: 20px; }
          .meta { margin-bottom: 10px; font-size: 14px; }
          @media print { .no-print { display: none; } }
        </style>
      </head><body>
        <div class="header">
          <h1>${escapeHtml(settings.restaurantName)}</h1>
          <p>${escapeHtml(settings.tagline || '')}</p>
        </div>
        <h2>Order Statement</h2>
        <div class="meta">
          <p><strong>Filters:</strong> ${year || 'All years'} / ${monthLabel || 'All months'} / ${status || 'All statuses'}</p>
          <p><strong>Total Orders:</strong> ${orders.length} &nbsp;|&nbsp; <strong>Total Value:</strong> ${formatMoney(total)}</p>
        </div>
        <table>
          <thead><tr><th>Order #</th><th>Date & Time</th><th>Location</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" style="text-align:center">No orders</td></tr>'}</tbody>
        </table>
        <div class="no-print" style="margin-top: 20px">
          <button onclick="window.print()" style="padding: 10px 20px; border: 0; border-radius: 6px; background: #1a1a1a; color: #fff; cursor: pointer;">Print Statement</button>
        </div>
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  function renderSettingsHtml() {
    const settings = AverroesDB.getSettings();
    return `
      <form id="settings-form" class="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4 max-w-2xl">
        <h3 class="font-serif text-lg font-bold text-zinc-900">Business Details</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Restaurant Name</label><input type="text" name="restaurantName" value="${settings.restaurantName}" class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" required></div>
          <div><label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Tagline</label><input type="text" name="tagline" value="${settings.tagline}" class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" required></div>
          <div class="sm:col-span-2"><label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Address</label><input type="text" name="address" value="${settings.address || ''}" class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" required></div>
          <div class="sm:col-span-2"><label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Logo / Business Image URL</label><input type="url" name="logoUrl" value="${settings.logoUrl || ''}" placeholder="https://example.com/logo.png" class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm"></div>
          <input type="hidden" name="currency" value="${settings.currency}">
          <input type="hidden" name="locale" value="${settings.locale}">
        </div>
        <div class="flex flex-wrap items-center gap-3 pt-4 border-t border-zinc-100">
          <button type="submit" class="px-5 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800">Save Settings</button>
          <button type="button" id="export-data" class="px-4 py-2.5 bg-white border border-zinc-300 text-zinc-800 rounded-lg text-sm font-semibold hover:border-brand-gold">Export Data</button>
          <button type="button" id="import-data-btn" class="px-4 py-2.5 bg-white border border-zinc-300 text-zinc-800 rounded-lg text-sm font-semibold hover:border-brand-gold">Import Data</button>
          ${AverroesDB.isManager() ? `<button type="button" id="reset-data" class="px-4 py-2.5 bg-red-50 text-red-700 border border-red-100 rounded-lg text-sm font-semibold hover:bg-red-100 ml-auto">Reset to Defaults</button>` : ''}
        </div>
      </form>
      <input type="file" id="import-file" accept="application/json" class="hidden">

      <div class="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4 max-w-2xl mt-6">
        <h3 class="font-serif text-xl font-bold text-zinc-900">Admin Management</h3>
        <p class="text-sm text-zinc-500">Add, edit, disable or remove admin accounts. At least one enabled admin must remain.</p>
        <div id="admin-list" class="space-y-2"></div>
        <form id="admin-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-100" onsubmit="return false;">
          <input type="text" name="username" placeholder="Username" required class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm">
          <input type="text" name="displayName" placeholder="Display name (optional)" class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm">
          <input type="password" name="password" placeholder="Password" required class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm">
          <input type="password" name="confirmPassword" placeholder="Confirm password" required class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm">
          ${AverroesDB.isManager() ? `
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Role</label>
            <select name="role" class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="staff" selected>Staff / Normal admin</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          ` : '<input type="hidden" name="role" value="staff">'}
          <div class="sm:col-span-2">
            <button type="submit" class="px-4 py-2.5 bg-zinc-900 text-white text-sm font-semibold rounded-lg hover:bg-zinc-800">Add Admin</button>
          </div>
        </form>
      </div>
    `;
  }

  function renderAdminList() {
    const list = document.getElementById('admin-list');
    if (!list) return;
    const isManager = AverroesDB.isManager();
    const users = AverroesDB.getUsers().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    list.innerHTML = users.map(u => {
      const canManage = isManager || u.role !== 'manager';
      const controls = canManage ? `
        <div class="flex items-center gap-2">
          <button data-edit-user="${u.id}" class="px-2 py-1 text-xs bg-zinc-100 rounded hover:bg-zinc-200">Edit</button>
          <button data-disable-user="${u.id}" class="px-2 py-1 text-xs ${u.disabled ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'} rounded hover:opacity-80">${u.disabled ? 'Enable' : 'Disable'}</button>
          <button data-delete-user="${u.id}" class="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100">Delete</button>
        </div>
      ` : `<span class="text-[10px] text-zinc-400">Protected</span>`;
      return `
      <div class="flex items-center justify-between p-3 border border-zinc-200 rounded-lg ${u.disabled ? 'opacity-50 bg-zinc-50' : 'bg-white'}">
        <div>
          <p class="font-semibold text-sm text-zinc-900">${escapeHtml(u.username)} <span class="text-[10px] text-zinc-500 ml-2">${u.role || 'admin'}${u.disabled ? ' • disabled' : ''}</span></p>
        </div>
        ${controls}
      </div>
    `;
    }).join('');
    list.querySelectorAll('button').forEach(btn => btn.addEventListener('click', handleAdminAction));
  }

  async function handleAdminAction(e) {
    const btn = e.currentTarget;
    const id = btn.dataset.editUser || btn.dataset.deleteUser || btn.dataset.disableUser;
    const users = AverroesDB.getUsers();
    const user = users.find(u => u.id === id);
    if (!user) return;
    if (btn.dataset.editUser) {
      const newUsername = prompt('New username:', user.username);
      if (newUsername === null) return;
      const newPassword = prompt('New password (leave blank to keep current):');
      if (newPassword === null) return;
      const updates = { username: newUsername.trim() };
      if (newPassword.trim()) updates.password = newPassword.trim();
      const updated = await AverroesDB.updateUser(id, updates);
      if (!updated) { toast('Unauthorized or failed'); return; }
      renderAdminList();
      toast('Admin updated');
    }
    if (btn.dataset.disableUser) {
      const updated = await AverroesDB.toggleUserDisabled(id);
      if (!updated) { toast('Unauthorized or failed'); return; }
      renderAdminList();
      toast(updated.disabled ? 'Admin disabled' : 'Admin enabled');
    }
    if (btn.dataset.deleteUser && confirm(`Delete admin ${user.username}?`)) {
      if (AverroesDB.deleteUser(id)) {
        renderAdminList();
        toast('Admin deleted');
      } else {
        toast('At least one enabled admin must remain or unauthorized');
      }
    }
  }

  function attachTabListeners(tab) {
    if (tab === 'menu') {
      dom.menuSearch = document.getElementById('menu-search');
      dom.menuSearch.addEventListener('input', () => renderMenuList(dom.menuSearch.value));
      document.getElementById('add-meal-btn').addEventListener('click', () => openMealModal());
      document.getElementById('add-category-btn').addEventListener('click', () => {
        const title = prompt('New category name:');
        if (title && title.trim()) {
          const subtitle = prompt('Subtitle (optional):') || '';
          AverroesDB.addCategory(title.trim(), subtitle.trim());
          renderCategoriesList();
          renderMenuList(dom.menuSearch?.value || '');
          toast('Category added');
        }
      });
      renderCategoriesList();
      renderMenuList();
    }
    if (tab === 'orders') {
      const yearFilter = document.getElementById('order-year-filter');
      const monthFilter = document.getElementById('order-month-filter');
      const statusFilter = document.getElementById('order-status-filter');
      const currentBtn = document.getElementById('show-current-orders');
      const allBtn = document.getElementById('show-all-history');
      const printBtn = document.getElementById('print-statement');
      renderFilteredOrders();
      [yearFilter, monthFilter, statusFilter].forEach(el => {
        if (el) el.addEventListener('change', renderFilteredOrders);
      });
      if (currentBtn) {
        currentBtn.addEventListener('click', () => {
          if (yearFilter) yearFilter.value = '';
          if (monthFilter) monthFilter.value = '0';
          if (statusFilter) statusFilter.value = 'Active';
          renderFilteredOrders();
        });
      }
      if (allBtn) {
        allBtn.addEventListener('click', () => {
          if (yearFilter) yearFilter.value = '';
          if (monthFilter) monthFilter.value = '0';
          if (statusFilter) statusFilter.value = 'All statuses';
          renderFilteredOrders();
        });
      }
      if (printBtn) printBtn.addEventListener('click', printStatement);
    }
    if (tab === 'settings') {
      if (AverroesDB.isStaff()) renderAdminList();
      document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const current = AverroesDB.getSettings();
        const settings = { ...current };
        for (const [k, v] of fd.entries()) {
          settings[k] = v;
        }
        AverroesDB.saveSettings(settings);
        toast('Settings saved');
      });
      const adminForm = document.getElementById('admin-form');
      if (adminForm) {
        adminForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const username = fd.get('username').trim();
          const displayName = (fd.get('displayName') || '').trim();
          const password = fd.get('password');
          const confirmPassword = fd.get('confirmPassword');
          const role = (fd.get('role') || 'staff').trim();
          if (!username || !password) {
            toast('Username and password are required');
            return;
          }
          if (password !== confirmPassword) {
            toast('Passwords do not match');
            return;
          }
          if (AverroesDB.getUsers().some(u => u.username === username)) {
            toast('Username already exists');
            return;
          }
          const created = await AverroesDB.addUser(username, password, role, displayName);
          if (!created) { toast('Unauthorized or invalid role'); return; }
          e.target.reset();
          renderAdminList();
          toast('Admin created');
        });
      }
      document.getElementById('export-data').addEventListener('click', () => {
        const data = JSON.stringify(AverroesDB.exportAll(), null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `averroes-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
      document.getElementById('import-data-btn').addEventListener('click', () => document.getElementById('import-file').click());
      document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            AverroesDB.importAll(data);
            toast('Data imported');
            renderTab(currentTab);
          } catch (err) {
            toast('Invalid JSON file');
          }
        };
        reader.readAsText(file);
      });
      const resetBtn2 = document.getElementById('reset-data');
      if (resetBtn2) {
        resetBtn2.addEventListener('click', () => {
          if (!AverroesDB.isManager()) { toast('Manager only'); return; }
          const msg = 'Reset EVERYTHING to factory defaults? This will replace menu, categories, settings, orders and admin accounts. This cannot be undone.';
          if (confirm(msg)) {
            AverroesDB.resetToSeed();
            toast('Data reset');
            renderTab(currentTab);
          }
        });
      }
    }
    if (tab === 'chats') {
      currentChatId = null;
      renderChatList();
      attachChatReply();
      startChatPolling();
    }
    document.querySelectorAll('.goto-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.goto)));
  }

  function attachGlobalListeners() {
    dom.sidebar.querySelectorAll('a[data-tab]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(a.dataset.tab);
      });
    });

    dom.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      if (await AverroesDB.login(fd.get('username'), fd.get('password'))) {
        toggleViews();
      } else {
        toast('Invalid credentials');
      }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      AverroesDB.logout();
      toggleViews();
    });
  }

  function renderChatsHtml() {
    return `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 h-[calc(100vh-220px)] min-h-[400px]">
        <div class="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
          <div class="p-4 border-b border-zinc-200"><h2 class="font-serif text-lg font-bold text-zinc-900">Conversations</h2></div>
          <div id="chat-list" class="flex-1 overflow-y-auto p-3 space-y-2"></div>
        </div>
        <div class="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
          <div id="chat-view-header" class="p-4 border-b border-zinc-200 flex items-center justify-between min-h-[60px]">
            <h2 class="font-serif text-lg font-bold text-zinc-900">Select a conversation</h2>
          </div>
          <div id="chat-view-messages" class="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50"></div>
          <form id="chat-reply-form" class="p-4 border-t border-zinc-200 bg-white flex gap-2 hidden" onsubmit="return false;">
            <input type="text" id="chat-reply-input" class="flex-1 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm" placeholder="Type a reply..." autocomplete="off">
            <button type="submit" class="h-10 w-10 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-800"><i class="fa-solid fa-paper-plane text-sm"></i></button>
          </form>
        </div>
      </div>
    `;
  }

  function renderAdminTotalBadge() {
    if (!dom.chatTotalBadge) return;
    const total = AverroesDB.getTotalUnreadCountForAdmin();
    if (!adminBadgeInitialized) {
      lastAdminUnread = total;
      adminBadgeInitialized = true;
    } else if (total > lastAdminUnread) {
      playNotificationSound();
    }
    lastAdminUnread = total;
    if (total > 0) {
      dom.chatTotalBadge.textContent = total > 99 ? '99+' : total;
      dom.chatTotalBadge.classList.remove('hidden');
      dom.chatTotalBadge.style.display = 'inline-flex';
    } else {
      dom.chatTotalBadge.classList.add('hidden');
      dom.chatTotalBadge.style.display = 'none';
    }
  }

  function renderChatList() {
    const list = document.getElementById('chat-list');
    if (!list) return;
    const chats = AverroesDB.getChats().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    list.innerHTML = chats.map(c => {
      const last = c.messages[c.messages.length - 1];
      const snippet = last ? (last.text.length > 50 ? last.text.substring(0, 50) + '...' : last.text) : 'No messages yet';
      const order = c.orderId ? AverroesDB.getOrders().find(o => o.id === c.orderId) : null;
      const title = order ? `${order.orderNumber} — ${c.location}${c.identifier ? ' • ' + c.identifier : ''}` : `Guest — ${c.location}${c.identifier ? ' • ' + c.identifier : ''}`;
      const unread = AverroesDB.getUnreadCountForChat(c.id);
      const unreadBadge = unread > 0 ? `<span class="ml-auto bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">${unread > 99 ? '99+' : unread}</span>` : '';
      return `
        <button data-chat-id="${c.id}" class="w-full text-left p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors ${currentChatId === c.id ? 'bg-zinc-100 border-zinc-300' : 'bg-white'} ${unread ? 'border-amber-300 bg-amber-50' : ''}">
          <p class="font-semibold text-sm text-zinc-900 truncate flex items-center justify-between">${escapeHtml(title)}${unreadBadge}</p>
          <p class="text-xs text-zinc-500 truncate mt-1">${escapeHtml(snippet)}</p>
          <p class="text-[10px] text-zinc-400 mt-1">${new Date(c.updatedAt).toLocaleString()}</p>
        </button>
      `;
    }).join('');
    list.querySelectorAll('button[data-chat-id]').forEach(btn => {
      btn.addEventListener('click', () => openChatView(btn.dataset.chatId));
    });
    renderAdminTotalBadge();
  }

  function openChatView(id) {
    currentChatId = id;
    AverroesDB.markMessagesAsRead(id, 'admin');
    renderChatList();
    renderChatView(id);
  }

  function renderChatView(id) {
    const chat = AverroesDB.getConversation(id);
    const header = document.getElementById('chat-view-header');
    const messages = document.getElementById('chat-view-messages');
    const form = document.getElementById('chat-reply-form');
    if (!chat || !header || !messages || !form) return;
    currentChatId = id;
    AverroesDB.markMessagesAsRead(id, 'admin');
    const order = chat.orderId ? AverroesDB.getOrders().find(o => o.id === chat.orderId) : null;
    const title = order ? order.orderNumber : 'Direct message';
    const subtitle = `${chat.location}${chat.identifier ? ' • ' + chat.identifier : ''}`;
    const showConfirmBtn = order && (order.status === 'PENDING' || order.status === 'NEW');
    const confirmBtn = showConfirmBtn ? `<button id="confirm-order-btn" class="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">Confirm Order</button>` : '';
    header.innerHTML = `
      <div>
        <h2 class="font-serif text-lg font-bold text-zinc-900">${escapeHtml(title)}</h2>
        <p class="text-xs text-zinc-500">${escapeHtml(subtitle)}</p>
      </div>
      ${confirmBtn}
    `;
    messages.innerHTML = chat.messages.map(m => {
      const isAdmin = m.sender === 'admin';
      const isOrder = m.messageType === 'order';
      const isSystem = m.messageType === 'system';
      
      if (isSystem) {
        return `
          <div class="flex justify-center">
            <div class="max-w-[85%] rounded-xl px-4 py-3 text-sm bg-blue-50 border border-blue-200 text-blue-800">
              <div class="flex items-start gap-2">
                <i class="fa-solid fa-circle-info text-blue-600 mt-0.5"></i>
                <div class="whitespace-pre-line">${escapeHtml(m.text)}</div>
              </div>
            </div>
          </div>
          <p class="text-[10px] text-zinc-400 text-center">${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        `;
      }
      
      if (isOrder) {
        return `
          <div class="flex ${isAdmin ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[85%] rounded-2xl px-4 py-3 text-sm ${isAdmin ? 'bg-zinc-100 border border-zinc-200 text-zinc-800 rounded-br-none' : 'bg-amber-50 border border-amber-300 text-zinc-900 rounded-bl-none'}">
              <div class="whitespace-pre-line font-medium">${escapeHtml(m.text)}</div>
            </div>
          </div>
          <p class="text-[10px] text-zinc-400 ${isAdmin ? 'text-right' : 'text-left'}">${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        `;
      }
      
      return `
        <div class="flex ${isAdmin ? 'justify-end' : 'justify-start'}">
          <div class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${isAdmin ? 'bg-zinc-900 text-white rounded-br-none' : 'bg-white border border-zinc-200 text-zinc-800 rounded-bl-none'}">
            ${escapeHtml(m.text)}
          </div>
        </div>
        <p class="text-[10px] text-zinc-400 ${isAdmin ? 'text-right' : 'text-left'}">${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      `;
    }).join('') || '<p class="text-center text-zinc-500 text-sm py-8">No messages yet.</p>';
    messages.scrollTop = messages.scrollHeight;
    form.classList.remove('hidden');
    const input = document.getElementById('chat-reply-input');
    input.value = '';
    if (showConfirmBtn) {
      const btn = document.getElementById('confirm-order-btn');
      if (btn) btn.addEventListener('click', () => confirmOrder(order.id, chat.id));
    }
  }

  async function confirmOrder(orderId, chatId) {
    const order = AverroesDB.getOrders().find(o => o.id === orderId);
    if (!order) return;

    const result = await AverroesDB.adminUpdateOrderStatus(orderId, 'CONFIRMED');
    if (result.error) {
      toast('Unable to confirm order');
      return;
    }

    const confirmationMsg = `✅ Order Confirmed\n\nYour order has been received and confirmed.\n\nWe are now preparing your order and it will be delivered to your location shortly.\n\nThank you for your order!`;
    AverroesDB.addMessage(chatId, 'system', confirmationMsg, 'system');

    AverroesDB.addTransaction({
      type: 'REVENUE',
      description: `Order ${order.orderNumber}`,
      amount: order.total,
      relatedId: order.id,
      category: 'Food Sales',
      status: 'CONFIRMED'
    });

    toast('Order confirmed and customer notified');
    renderChatView(chatId);
    renderChatList();
    if (currentTab === 'dashboard') renderTab('dashboard');
    if (currentTab === 'orders') renderTab('orders');
  }

  function attachChatReply() {
    const form = document.getElementById('chat-reply-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-reply-input');
      const text = input.value.trim();
      if (!text || !currentChatId) return;
      AverroesDB.addMessage(currentChatId, 'admin', text);
      input.value = '';
      renderChatView(currentChatId);
      renderChatList();
    });
  }

  function playNotificationSound() {
    if (!notificationEnabled) return;
    try {
      if (!notificationAudio) {
        notificationAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
      }
      notificationAudio.play().catch(() => {});
    } catch (e) {}
  }

  function startChatPolling() {
    if (chatPollTimer) return;
    const chats = AverroesDB.getChats();
    lastMessageCount = chats.reduce((sum, c) => sum + c.messages.length, 0);
    
    chatPollTimer = setInterval(() => {
      renderAdminTotalBadge();
      if (currentTab !== 'chats') return;
      if (currentChatId) AverroesDB.markMessagesAsRead(currentChatId, 'admin');
      renderChatList();
      if (currentChatId) renderChatView(currentChatId);
    }, 4000);
  }

  function init() {
    cacheDom();
    attachGlobalListeners();
    toggleViews();
    startChatPolling();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
