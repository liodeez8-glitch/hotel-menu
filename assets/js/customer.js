/**
 * Averroes Restaurant - Customer Menu Experience
 * Handles navigation, search, filtering and menu display.
 * View-only menu — no ordering, cart, or chat functionality.
 */
(function () {
  'use strict';

  const state = {
    search: '',
    activeFilters: new Set(),
    activeCategory: null
  };

  const dom = {};

  const FILTER_MAP = [];

  function formatMoney(amount) {
    const settings = AverroesDB.getSettings();
    return settings.currency + amount.toLocaleString(settings.locale);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function cacheDom() {
    dom.nav = document.getElementById('category-nav');
    dom.navArrow = document.getElementById('nav-arrow');
    dom.search = document.getElementById('search-input');
    dom.clearSearch = document.getElementById('clear-search');
    dom.filterChips = document.getElementById('filter-chips');
    dom.menu = document.getElementById('menu-container');
    dom.brandName = document.getElementById('brand-name');
    dom.brandTagline = document.getElementById('brand-tagline');
    dom.hotelAddress = document.getElementById('hotel-address');
    dom.siteLogo = document.getElementById('site-logo');
  }

  function sortedCategories() {
    return AverroesDB.getCategories().slice().sort((a, b) => (a.order || 0) - (b.order || 0));
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

  function cardHtml(meal) {
    const unavailable = !meal.available || meal.outOfStock;
    const name = escapeHtml(meal.name);
    const imgSrc = meal.image ? escapeHtml(meal.image) : '';
    const imgHtml = imgSrc
      ? `<img src="${imgSrc}" alt="${name}" loading="lazy" class="h-full w-full object-cover${unavailable ? ' blur-[2px] grayscale' : ''}" />`
      : `<div class="h-full w-full flex items-center justify-center"><i class="fa-solid fa-utensils text-amber-500 text-3xl"></i></div>`;
    const statusBadge = unavailable
      ? `<span class="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 whitespace-nowrap">Not Available</span>`
      : '';
    return `
      <article class="bg-white rounded-2xl border border-zinc-100 p-3${unavailable ? ' opacity-60' : ''}" data-id="${meal.id}" data-name="${name}" data-price="${meal.price}">
        <div class="flex items-start gap-4">
          <div class="h-24 w-24 rounded-2xl overflow-hidden bg-amber-100 shrink-0">${imgHtml}</div>
          <div class="min-w-0 flex-1 pt-1 max-w-full"><h3 class="font-serif font-semibold text-lg text-zinc-900 whitespace-nowrap overflow-x-auto no-scrollbar leading-snug">${name}</h3></div>
          <div class="shrink-0 flex flex-col items-end gap-2 pt-1"><p class="text-red-600 font-extrabold text-2xl leading-none">${formatMoney(meal.price)}</p>${statusBadge}</div>
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

  function renderBranding() {
    const settings = AverroesDB.getSettings();
    if (dom.brandName) dom.brandName.textContent = settings.restaurantName || 'Averroes Restaurant';
    if (dom.brandTagline) dom.brandTagline.textContent = settings.tagline || 'Luxury Hotel Dining';
    if (dom.hotelAddress) dom.hotelAddress.textContent = settings.address || '';
    document.title = (settings.restaurantName || 'Averroes Restaurant') + ' | Digital Menu';
    if (dom.siteLogo) dom.siteLogo.src = settings.logoUrl || 'images/arlogo.png';
  }

  function startPolling() {
    setInterval(() => {
      renderBranding();
      renderNav();
      renderMenu();
    }, 5000);
  }

  async function init() {
    cacheDom();
    
    // Wait for the database to fetch live data before overriding the pre-rendered HTML
    if (window.AverroesDB && window.AverroesDB.init) {
      await window.AverroesDB.init();
    }
    
    renderBranding();
    renderNav();
    renderFilters();
    renderMenu();
    attachListeners();
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
