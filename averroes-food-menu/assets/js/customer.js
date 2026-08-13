/**
 * Averroes Restaurant - Customer Ordering Experience
 * Handles navigation, search, filtering, food cards, cart and checkout.
 */
(function () {
  'use strict';

  const state = {
    search: '',
    activeFilters: new Set(),
    activeCategory: null,
    cart: AverroesDB.getCart(),
    cartExpanded: false,
    checkoutOpen: false
  };

  const dom = {};

  const FILTER_MAP = [];

  let customerAudio = null;
  let lastCustomerUnread = 0;
  let customerBadgeInitialized = false;

  function formatMoney(amount) {
    const settings = AverroesDB.getSettings();
    return settings.currency + amount.toLocaleString(settings.locale);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function cacheDom() {
    dom.nav = document.getElementById('category-nav');
    dom.navArrow = document.getElementById('nav-arrow');
    dom.search = document.getElementById('search-input');
    dom.clearSearch = document.getElementById('clear-search');
    dom.filterChips = document.getElementById('filter-chips');
    dom.menu = document.getElementById('menu-container');
    dom.cartDrawer = document.getElementById('cart-drawer');
    dom.cartBadge = document.getElementById('cart-badge');
    dom.cartTotal = document.getElementById('cart-total');
    dom.cartDetails = document.getElementById('cart-details');
    dom.cartItems = document.getElementById('cart-items');
    dom.cartGrand = document.getElementById('cart-grand');
    dom.cartToggle = document.getElementById('cart-toggle');
    dom.checkoutBtn = document.getElementById('checkout-open');
    dom.checkoutModal = document.getElementById('checkout-modal');
    dom.checkoutForm = document.getElementById('checkout-form');
    dom.locationSelect = document.getElementById('order-location');
    dom.locationField = document.getElementById('location-field');
    dom.locationLabel = document.getElementById('location-label');
    dom.locationInput = document.getElementById('location-input');
    dom.checkoutActions = document.getElementById('checkout-actions');
    dom.brandName = document.getElementById('brand-name');
    dom.brandTagline = document.getElementById('brand-tagline');
    dom.hotelAddress = document.getElementById('hotel-address');
    dom.siteLogo = document.getElementById('site-logo');
    dom.chatToggle = document.getElementById('chat-toggle');
    dom.chatBadge = document.getElementById('chat-badge');
    dom.chatModal = document.getElementById('chat-modal');
    dom.closeChat = document.getElementById('close-chat');
    dom.closeChatIcon = document.getElementById('close-chat-icon');
    dom.chatMessages = document.getElementById('chat-messages');
    dom.chatForm = document.getElementById('chat-form');
    dom.chatInput = document.getElementById('chat-input');
    dom.ordersToggle = document.getElementById('orders-toggle');
    dom.ordersModal = document.getElementById('orders-modal');
    dom.closeOrders = document.getElementById('close-orders');
    dom.closeOrdersIcon = document.getElementById('close-orders-icon');
    dom.customerOrdersList = document.getElementById('customer-orders-list');
  }

  function getMealInfo(id) {
    const meal = AverroesDB.getMealById(id);
    if (!meal) return null;
    return { id, name: meal.name, price: meal.price || 0 };
  }

  function sortedCategories() {
    return AverroesDB.getCategories().slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const PILL_CLASS = 'cat-pill shrink-0 whitespace-nowrap snap-start px-4 py-2 rounded-full border border-zinc-300 text-xs font-semibold uppercase tracking-wider bg-white text-zinc-600';

  function renderNav() {
    const cats = sortedCategories();
    const buttons = [`<button class="${PILL_CLASS} ${!state.activeCategory ? 'active' : ''}">Menu</button>`];
    cats.forEach(cat => {
      buttons.push(`<button data-cat="${cat.id}" class="${PILL_CLASS} ${state.activeCategory === cat.id ? 'active' : ''}">${escapeHtml(cat.title)}</button>`);
    });
    dom.nav.innerHTML = buttons.join('');
    dom.nav.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.dataset.cat || '';
        if (!catId) {
          state.activeCategory = null;
          document.getElementById('menu-top').scrollIntoView({ behavior: 'smooth' });
          updateNavActive();
          return;
        }
        state.activeCategory = catId;
        const section = document.getElementById(`section-${catId}`);
        if (section) section.scrollIntoView({ behavior: 'smooth' });
        updateNavActive();
      });
    });
    requestAnimationFrame(updateNavArrow);
  }

  function updateNavActive() {
    dom.nav.querySelectorAll('button').forEach(btn => {
      const catId = btn.dataset.cat || '';
      const isActive = catId ? state.activeCategory === catId : !state.activeCategory;
      btn.classList.toggle('active', isActive);
    });
  }

  function updateNavArrow() {
    if (!dom.navArrow || !dom.nav) return;
    const show = dom.nav.scrollWidth > dom.nav.clientWidth && dom.nav.scrollLeft + dom.nav.clientWidth < dom.nav.scrollWidth - 4;
    dom.navArrow.classList.toggle('hidden', !show);
  }

  function renderFilters() {
    dom.filterChips.innerHTML = FILTER_MAP.map(f => {
      const active = state.activeFilters.has(f.id) ? 'active' : '';
      return `<button data-filter="${f.id}" class="filter-chip px-3 py-1.5 rounded-full border border-zinc-300 text-xs font-medium bg-white text-zinc-600 ${active}">${f.label}</button>`;
    }).join('');
    dom.filterChips.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.filter;
        if (state.activeFilters.has(id)) state.activeFilters.delete(id);
        else state.activeFilters.add(id);
        renderFilters();
        renderMenu();
      });
    });
  }

  function controlsHtml(id, qty) {
    if (qty > 0) {
      return `<div class="flex items-center gap-1">
           <button data-action="dec" data-id="${id}" class="h-9 w-9 rounded bg-zinc-100 text-zinc-800 hover:bg-zinc-200 flex items-center justify-center text-sm font-bold" aria-label="Decrease">-</button>
           <span class="w-7 text-center text-sm font-bold text-zinc-900">${qty}</span>
           <button data-action="inc" data-id="${id}" class="h-9 w-9 rounded bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center text-sm font-bold" aria-label="Increase">+</button>
         </div>`;
    }
    return `<button data-action="add" data-id="${id}" class="h-9 px-5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm rounded-lg transition-colors">Order</button>`;
  }

  function updateCardControls(id) {
    const holder = dom.menu.querySelector(`article[data-id="${id}"] .card-controls`);
    if (holder) holder.innerHTML = controlsHtml(id, state.cart[id] || 0);
  }

  function cardHtml(meal) {
    const qty = state.cart[meal.id] || 0;
    const unavailable = !meal.available || meal.outOfStock;
    const name = escapeHtml(meal.name);
    const imgSrc = meal.image ? escapeHtml(meal.image) : '';
    const imgHtml = imgSrc
      ? `<img src="${imgSrc}" alt="${name}" class="h-full w-full object-cover${unavailable ? ' blur-[2px] grayscale' : ''}" />`
      : `<div class="h-full w-full flex items-center justify-center"><i class="fa-solid fa-utensils text-amber-500 text-3xl"></i></div>`;
    const controls = unavailable
      ? `<span class="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 whitespace-nowrap">Not Available</span>`
      : `<div class="card-controls">${controlsHtml(meal.id, qty)}</div>`;
    return `
      <article class="bg-white rounded-2xl border border-zinc-100 p-3${unavailable ? ' opacity-60' : ''}" data-id="${meal.id}" data-name="${name}" data-price="${meal.price}">
        <div class="flex items-start gap-4">
          <div class="h-24 w-24 rounded-2xl overflow-hidden bg-amber-100 shrink-0">${imgHtml}</div>
          <div class="min-w-0 flex-1 pt-1"><h3 class="font-serif font-semibold text-lg text-zinc-900 truncate leading-snug">${name}</h3></div>
          <div class="shrink-0 flex flex-col items-end gap-2 pt-1"><p class="text-red-600 font-extrabold text-2xl leading-none">${formatMoney(meal.price)}</p>${controls}</div>
        </div>
      </article>`;
  }

  function renderMenu() {
    const q = state.search.trim().toLowerCase();
    const cats = sortedCategories();
    const meals = AverroesDB.getMeals().filter(m => !m.hidden);
    let anyVisible = false;
    let html = '';

    cats.forEach(cat => {
      const catTitle = (cat.title || '').toLowerCase();
      const catMeals = meals.filter(m => m.categoryId === cat.id)
        .filter(m => !q || m.name.toLowerCase().includes(q) || catTitle.includes(q));
      if (q && catMeals.length === 0) return;
      anyVisible = anyVisible || catMeals.length > 0 || !q;
      html += `
        <section id="section-${cat.id}" class="mb-12 scroll-mt-48">
          <div class="category-heading"><h2 class="font-serif text-2xl text-zinc-900">${escapeHtml(cat.title)}</h2><p class="text-sm text-zinc-500 mt-1">${escapeHtml(cat.subtitle || '')}</p></div>
          <div class="space-y-3">${catMeals.map(cardHtml).join('')}</div>
        </section>`;
    });

    html += `
      <div id="no-results" class="${anyVisible ? 'hidden ' : ''}text-center py-16 bg-white/60 rounded-2xl border border-zinc-200">
        <div class="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3"><i class="fa-solid fa-utensils text-amber-600 text-2xl"></i></div>
        <h3 class="font-serif font-semibold text-xl text-zinc-800">No dishes found</h3>
        <p class="text-zinc-500 text-sm mt-2 max-w-xs mx-auto">Try adjusting your search or filters to find something delightful.</p>
      </div>`;

    dom.menu.innerHTML = html;
    initScrollSpy();
  }

  function updateCart(id, change) {
    const meal = AverroesDB.getMealById(id);
    if (!meal || ((!meal.available || meal.outOfStock) && change > 0)) return;
    const current = state.cart[id] || 0;
    const next = current + change;
    if (next <= 0) delete state.cart[id];
    else state.cart[id] = next;
    AverroesDB.saveCart(state.cart);
    updateCardControls(id);
    renderCart();
  }

  function calculateOrderTotal() {
    let total = 0;
    Object.entries(state.cart).forEach(([id, qty]) => {
      const meal = getMealInfo(id);
      if (meal) total += meal.price * qty;
    });
    return { total };
  }

  function renderCart() {
    let totalQty = 0;
    let summaryHTML = '';
    Object.entries(state.cart).forEach(([id, qty]) => {
      const meal = getMealInfo(id);
      if (!meal) return;
      totalQty += qty;
      const line = meal.price * qty;
      summaryHTML += `
        <div class="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
          <div class="min-w-0 pr-4">
            <p class="text-sm font-medium text-zinc-200 truncate">${meal.name}</p>
            <p class="text-[10px] text-zinc-500">${formatMoney(meal.price)} × ${qty}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button data-cart-dec="${id}" class="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white"><i class="fa-solid fa-minus text-[9px]"></i></button>
            <span class="text-xs font-bold w-4 text-center text-amber-400">${qty}</span>
            <button data-cart-inc="${id}" class="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white"><i class="fa-solid fa-plus text-[9px]"></i></button>
          </div>
        </div>`;
    });

    const totals = calculateOrderTotal();
    dom.cartBadge.textContent = totalQty;
    dom.cartTotal.textContent = formatMoney(totals.total);
    dom.cartItems.innerHTML = summaryHTML || '<p class="text-zinc-500 text-sm text-center py-4">Your order is empty.</p>';
    dom.cartGrand.textContent = formatMoney(totals.total);

    if (totalQty > 0) {
      dom.cartDrawer.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
      dom.cartDrawer.classList.add('translate-y-0', 'opacity-100');
    } else {
      dom.cartDrawer.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
      dom.cartDrawer.classList.remove('translate-y-0', 'opacity-100');
      state.cartExpanded = false;
      dom.cartDetails.classList.add('hidden');
    }

    dom.cartItems.querySelectorAll('button[data-cart-inc], button[data-cart-dec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.cartInc || btn.dataset.cartDec;
        const change = btn.dataset.cartInc ? 1 : -1;
        updateCart(id, change);
      });
    });
  }

  function buildOrderText(order) {
    const date = new Date(order.createdAt).toLocaleDateString();
    const time = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let text = `📋 Order ${order.orderNumber}\n\n`;
    text += `📍 Location: ${order.location}`;
    if (order.identifier) text += ` • ${order.identifier}`;
    text += `\n🕐 ${date} at ${time}\n\n`;
    text += `Items:\n`;
    (order.items || []).forEach(item => {
      text += `• ${item.qty}× ${item.name} — ${formatMoney(item.price * item.qty)}\n`;
    });
    text += `\n💰 Total: ${formatMoney(order.total)}\n\n`;
    text += `⏳ Status: Pending Confirmation`;
    return text;
  }

  function openCheckout() {
    const totals = calculateOrderTotal();
    if (totals.total <= 0) {
      showToast('Please add items to your order first.');
      return;
    }
    state.checkoutOpen = true;
    dom.checkoutModal.classList.remove('hidden');
    dom.checkoutModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  function closeCheckout() {
    state.checkoutOpen = false;
    dom.checkoutModal.classList.add('hidden');
    dom.checkoutModal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  function updateLocationField() {
    const map = {
      '': 'Location details',
      'Hotel Room': 'Room Number',
      'Restaurant': 'Table Number',
      'Poolside': 'Cabana Number',
      'Lounge': 'Seat Number',
      'Conference Hall': 'Hall Name',
      'Takeaway': 'Guest Name'
    };
    const val = dom.locationSelect.value;
    dom.locationLabel.textContent = map[val] || 'Details';
    dom.locationField.classList.toggle('hidden', !val);
  }

  function attachListeners() {
    dom.search.addEventListener('input', (e) => {
      state.search = e.target.value;
      dom.clearSearch.classList.toggle('hidden', !state.search);
      renderMenu();
    });

    dom.clearSearch.addEventListener('click', () => {
      dom.search.value = '';
      state.search = '';
      dom.clearSearch.classList.add('hidden');
      renderMenu();
    });

    dom.menu.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'add' || action === 'inc') updateCart(id, 1);
      else if (action === 'dec') updateCart(id, -1);
    });

    dom.cartToggle.addEventListener('click', () => {
      state.cartExpanded = !state.cartExpanded;
      dom.cartDetails.classList.toggle('hidden', !state.cartExpanded);
    });

    document.getElementById('clear-cart').addEventListener('click', () => {
      const ids = Object.keys(state.cart);
      state.cart = {};
      AverroesDB.saveCart(state.cart);
      ids.forEach(updateCardControls);
      renderCart();
    });

    dom.checkoutBtn.addEventListener('click', openCheckout);

    document.getElementById('close-checkout').addEventListener('click', closeCheckout);
    document.getElementById('close-checkout-icon').addEventListener('click', closeCheckout);

    dom.locationSelect.addEventListener('change', updateLocationField);

    dom.checkoutActions.querySelectorAll('button[data-checkout]').forEach(btn => {
      btn.addEventListener('click', () => {
        const location = dom.locationSelect.value;
        const identifier = dom.locationInput.value.trim();
        if (!location) {
          showToast('Please select where you are ordering from.');
          dom.locationSelect.focus();
          return;
        }
        if (!identifier && location !== 'Takeaway') {
          showToast('Please enter your ' + dom.locationLabel.textContent.toLowerCase() + '.');
          dom.locationInput.focus();
          return;
        }

        btn.disabled = true;
        const customerId = getCustomerId();
        const order = AverroesDB.addOrder({ items: { ...state.cart }, location, identifier, method: 'direct', customerId });
        
        const chat = AverroesDB.getConversationsForCustomer(customerId).find(c => c.orderId === order.id) || 
                     AverroesDB.createChat(customerId, order.id, location, identifier);
        
        const orderText = buildOrderText(order);
        AverroesDB.addMessage(chat.id, 'customer', orderText, 'order', { orderId: order.id });

        const orderedIds = Object.keys(state.cart);
        state.cart = {};
        AverroesDB.saveCart(state.cart);
        orderedIds.forEach(updateCardControls);
        renderCart();
        closeCheckout();
        
        showToast('Order sent successfully!');
        setTimeout(() => {
          openChat();
        }, 500);
        btn.disabled = false;
      });
    });
  }

  let scrollSpyObserver = null;
  function initScrollSpy() {
    if (scrollSpyObserver) scrollSpyObserver.disconnect();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id.replace('section-', '');
          state.activeCategory = id;
          updateNavActive();
        }
      });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

    document.querySelectorAll('[id^="section-"]').forEach(section => observer.observe(section));
  }

  function getCustomerId() {
    let id = localStorage.getItem('av_customer_id');
    if (!id) {
      id = (AverroesDB.uuid ? AverroesDB.uuid() : Math.random().toString(36).slice(2));
      localStorage.setItem('av_customer_id', id);
    }
    return id;
  }

  function renderBranding() {
    const settings = AverroesDB.getSettings();
    if (dom.brandName) dom.brandName.textContent = settings.restaurantName || 'Averroes Restaurant';
    if (dom.brandTagline) dom.brandTagline.textContent = settings.tagline || 'Luxury Hotel Dining';
    if (dom.hotelAddress) dom.hotelAddress.textContent = settings.address || '';
    document.title = (settings.restaurantName || 'Averroes Restaurant') + ' | Digital Menu';
    if (dom.siteLogo) dom.siteLogo.src = settings.logoUrl || 'images/arlogo.png';
  }

  function playCustomerNotification() {
    if (!customerAudio) {
      customerAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
    }
    customerAudio.play().catch(() => {});
  }

  function renderChatBadge() {
    const customerId = getCustomerId();
    const count = AverroesDB.getUnreadCountForCustomer(customerId);
    if (!customerBadgeInitialized) {
      lastCustomerUnread = count;
      customerBadgeInitialized = true;
    } else if (count > lastCustomerUnread) {
      playCustomerNotification();
    }
    lastCustomerUnread = count;
    if (!dom.chatBadge) return;
    if (count > 0) {
      dom.chatBadge.textContent = count > 99 ? '99+' : count;
      dom.chatBadge.classList.remove('hidden');
      dom.chatBadge.style.display = 'flex';
    } else {
      dom.chatBadge.classList.add('hidden');
      dom.chatBadge.style.display = 'none';
    }
  }

  function openChat() {
    dom.chatModal.classList.remove('hidden');
    dom.chatModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    const customerId = getCustomerId();
    AverroesDB.getConversationsForCustomer(customerId).forEach(c => AverroesDB.markMessagesAsRead(c.id, 'customer'));
    renderChatBadge();
    renderCustomerChat();
  }

  function closeChat() {
    dom.chatModal.classList.add('hidden');
    dom.chatModal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  function openOrders() {
    dom.ordersModal.classList.remove('hidden');
    dom.ordersModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    renderCustomerOrders();
  }

  function closeOrders() {
    dom.ordersModal.classList.add('hidden');
    dom.ordersModal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  async function renderCustomerOrders() {
    const customerId = getCustomerId();
    const orders = AverroesDB.getOrders().filter(o => o.customerId === customerId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (!dom.customerOrdersList) return;
    dom.customerOrdersList.innerHTML = orders.length ? orders.map(o => {
      const date = new Date(o.createdAt);
      return `
        <div class="border border-zinc-200 rounded-xl p-3 mb-3 bg-white">
          <div class="flex justify-between items-center mb-2">
            <span class="font-semibold text-sm">${o.orderNumber}</span>
            <span class="text-xs uppercase tracking-wide px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">${o.status}</span>
          </div>
          <p class="text-xs text-zinc-500 mb-2">${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${formatMoney(o.total)}</p>
          <div class="space-y-1 text-xs text-zinc-600">
            ${(o.items || []).map(i => `<p>• ${i.qty}× ${escapeHtml(i.name)}</p>`).join('')}
          </div>
        </div>
      `;
    }).join('') : '<p class="text-sm text-zinc-500 text-center py-8">No orders yet.</p>';
  }

  function renderCustomerChat() {
    const customerId = getCustomerId();
    const convs = AverroesDB.getConversationsForCustomer(customerId);
    if (!convs.length) {
      dom.chatMessages.innerHTML = '<p class="text-zinc-500 text-sm text-center py-8">No active conversation. Place an order or send a message to reach the concierge.</p>';
      return;
    }
    const chat = convs[0];
    dom.chatMessages.innerHTML = chat.messages.map(m => {
      const isCustomer = m.sender === 'customer';
      const isOrder = m.messageType === 'order';
      const isSystem = m.messageType === 'system';
      
      if (isSystem) {
        return `
          <div class="flex justify-center">
            <div class="max-w-[85%] rounded-xl px-4 py-3 text-sm bg-green-50 border border-green-200 text-green-800">
              <div class="flex items-start gap-2">
                <i class="fa-solid fa-circle-check text-green-600 mt-0.5"></i>
                <div class="whitespace-pre-line">${escapeHtml(m.text)}</div>
              </div>
            </div>
          </div>
          <p class="text-[10px] text-zinc-400 text-center">${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        `;
      }
      
      if (isOrder) {
        return `
          <div class="flex ${isCustomer ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[85%] rounded-2xl px-4 py-3 text-sm ${isCustomer ? 'bg-amber-50 border border-amber-200 text-zinc-800 rounded-br-none' : 'bg-white border border-zinc-200 text-zinc-800 rounded-bl-none'}">
              <div class="whitespace-pre-line font-medium">${escapeHtml(m.text)}</div>
            </div>
          </div>
          <p class="text-[10px] text-zinc-400 ${isCustomer ? 'text-right' : 'text-left'}">${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        `;
      }
      
      return `
        <div class="flex ${isCustomer ? 'justify-end' : 'justify-start'}">
          <div class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${isCustomer ? 'bg-zinc-900 text-white rounded-br-none' : 'bg-white border border-zinc-200 text-zinc-800 rounded-bl-none'}">
            ${escapeHtml(m.text)}
          </div>
        </div>
        <p class="text-[10px] text-zinc-400 ${isCustomer ? 'text-right' : 'text-left'}">${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      `;
    }).join('');
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  }


  function sendCustomerMessage(text) {
    if (!text.trim()) return;
    const customerId = getCustomerId();
    let chat = AverroesDB.getConversationsForCustomer(customerId)[0];
    if (!chat) {
      chat = AverroesDB.createChat(customerId, null, '', '');
    }
    AverroesDB.addMessage(chat.id, 'customer', text.trim());
    renderCustomerChat();
  }

  function attachChatListeners() {
    if (dom.chatToggle) dom.chatToggle.addEventListener('click', openChat);
    if (dom.closeChat) dom.closeChat.addEventListener('click', closeChat);
    if (dom.closeChatIcon) dom.closeChatIcon.addEventListener('click', closeChat);
    if (dom.chatForm) dom.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendCustomerMessage(dom.chatInput.value);
      dom.chatInput.value = '';
      dom.chatInput.focus();
    });
    if (dom.ordersToggle) dom.ordersToggle.addEventListener('click', openOrders);
    if (dom.closeOrders) dom.closeOrders.addEventListener('click', closeOrders);
    if (dom.closeOrdersIcon) dom.closeOrdersIcon.addEventListener('click', closeOrders);
  }

  function startPolling() {
    setInterval(() => {
      renderBranding();
      renderNav();
      renderMenu();
      renderChatBadge();
      if (!dom.chatModal.classList.contains('hidden')) {
        const customerId = getCustomerId();
        AverroesDB.getConversationsForCustomer(customerId).forEach(c => AverroesDB.markMessagesAsRead(c.id, 'customer'));
        renderCustomerChat();
      }
    }, 5000);
  }

  function init() {
    getCustomerId();
    cacheDom();
    renderBranding();
    renderNav();
    renderChatBadge();
    renderFilters();
    renderMenu();
    Object.keys(state.cart).forEach(updateCardControls);
    renderCart();
    attachListeners();
    attachChatListeners();
    dom.navArrow.addEventListener('click', () => {
      dom.nav.scrollBy({ left: Math.min(dom.nav.clientWidth * 0.7, 240), behavior: 'smooth' });
    });
    dom.nav.addEventListener('scroll', updateNavArrow);
    window.addEventListener('resize', updateNavArrow);
    setTimeout(initScrollSpy, 100);
    startPolling();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
