/**
 * Averroes Villa Food Menu - Core Logic Engine
 * Handles async fetching, state management, search, category filtering, cart, and WhatsApp checkout.
 */

// Application State
const state = {
  menuItems: [],
  cart: {}, // Stores itemID -> quantity
  activeCategory: 'All Items',
  searchQuery: '',
  isCartExpanded: false
};

// Category Mapping (UI text -> menu.json category value)
const CATEGORY_MAP = {
  'All Items': 'All',
  'Local Delicacies': 'Local',
  'Continental': 'Continental',
  'Grills & Sides': 'Grills',
  'Drinks & Wine': 'Drinks'
};

// DOM Elements
const menuContainer = document.getElementById('menu-items-container');
const skeletonLoader = document.getElementById('skeleton-loader');
const noItemsFallback = document.getElementById('no-items-fallback');
const errorModal = document.getElementById('error-modal');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const categoryTabsContainer = document.getElementById('category-tabs');
const statusBanner = document.getElementById('status-banner');
const statusText = document.getElementById('status-text');
const resetFiltersBtn = document.getElementById('reset-filters');
const clearFiltersBtnFallback = document.getElementById('clear-filters-btn');

// Cart DOM Elements
const cartDrawer = document.getElementById('cart-drawer');
const cartBadge = document.getElementById('cart-badge');
const cartTotal = document.getElementById('cart-total');
const cartToggleBtn = document.getElementById('cart-toggle-btn');
const cartDetails = document.getElementById('cart-details');
const cartSummaryItems = document.getElementById('cart-summary-items');
const clearCartBtn = document.getElementById('clear-cart-btn');
const roomInput = document.getElementById('room-input');
const checkoutBtn = document.getElementById('checkout-btn');

// Helper to format currency in Nigerian Naira
function formatNaira(amount) {
  return '₦' + amount.toLocaleString('en-NG');
}

// 1. Initial Data Fetching
async function fetchMenu() {
  try {
    // Simulate slight network delay for natural resort transition feel
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const response = await fetch('./menu.json');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    state.menuItems = await response.json();
    
    // Hide skeleton and load menu
    if (skeletonLoader) skeletonLoader.classList.add('hidden');
    renderCategories();
    renderMenu();
  } catch (error) {
    console.error('Failed to load menu data:', error);
    if (skeletonLoader) skeletonLoader.classList.add('hidden');
    if (errorModal) errorModal.classList.remove('hidden');
  }
}

// 2. Render Category Filter Tabs
function renderCategories() {
  if (!categoryTabsContainer) return;
  
  const categories = ['All Items', 'Local Delicacies', 'Continental', 'Grills & Sides', 'Drinks & Wine'];
  
  categoryTabsContainer.innerHTML = categories.map(cat => {
    const isActive = state.activeCategory === cat;
    const activeClasses = 'bg-brandDark text-white border-brandDark';
    const inactiveClasses = 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300';
    
    return `
      <button 
        data-category="${cat}"
        class="snap-start shrink-0 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-full border transition-all duration-200 ${isActive ? activeClasses : inactiveClasses}"
      >
        ${cat}
      </button>
    `;
  }).join('');

  // Add click listeners to tabs
  categoryTabsContainer.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-category');
      setCategory(category);
    });
  });
}

// Set Active Category Filter
function setCategory(category) {
  state.activeCategory = category;
  renderCategories();
  updateStatusBanner();
  renderMenu();
}

// 3. Render Food Cards in Menu List
function renderMenu() {
  if (!menuContainer) return;
  
  // Filter menu items based on state
  const filteredItems = state.menuItems.filter(item => {
    // Category Filter
    const targetCategory = CATEGORY_MAP[state.activeCategory];
    const categoryMatches = (targetCategory === 'All' || item.category === targetCategory);
    
    // Search Query Filter (Checks Name, Description, and Category)
    const query = state.searchQuery.toLowerCase().trim();
    const searchMatches = !query || 
      item.name.toLowerCase().includes(query) || 
      item.description.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query);
      
    return categoryMatches && searchMatches;
  });

  // Toggle fallback display if no items match
  if (filteredItems.length === 0) {
    noItemsFallback.classList.remove('hidden');
  } else {
    noItemsFallback.classList.add('hidden');
  }

  // Generate and inject card components
  menuContainer.innerHTML = filteredItems.map(item => {
    const cartQty = state.cart[item.id] || 0;
    const hasAdded = cartQty > 0;
    
    return `
      <div class="menu-card bg-white p-3 rounded-2xl border border-zinc-150 shadow-sm flex gap-3.5 items-center transition-all duration-200">
        
        <!-- Left Side: Dish Cover Image -->
        <div class="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-zinc-100 border border-zinc-100">
          <img 
            src="${item.image}" 
            alt="${item.name}" 
            class="w-full h-full object-cover transition-opacity duration-300 opacity-0"
            onload="this.classList.remove('opacity-0')"
            onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300'; this.classList.remove('opacity-0');"
          >
          ${item.category === 'Local' ? '<span class="absolute top-1.5 left-1.5 bg-brandGold text-brandDark-deep font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wide uppercase">Local</span>' : ''}
        </div>

        <!-- Right Side: Dish Details -->
        <div class="flex-1 min-w-0 flex flex-col justify-between h-24 py-0.5">
          <div>
            <h3 class="font-bold text-zinc-900 text-sm leading-snug truncate">${item.name}</h3>
            <p class="text-[11px] text-zinc-500 mt-1 line-clamp-2 pr-2 leading-relaxed">${item.description}</p>
          </div>
          
          <div class="flex items-center justify-between mt-1">
            <!-- Price Accent -->
            <span class="font-bold text-brandGold text-sm tracking-tight">${formatNaira(item.price)}</span>
            
            <!-- Add to Cart / Increment Toggle Control -->
            <div class="flex items-center">
              ${hasAdded ? `
                <div class="flex items-center bg-brandDark text-white rounded-lg border border-brandDark shadow-sm overflow-hidden scale-95 origin-right transition-all">
                  <button 
                    onclick="updateCartItemQty(${item.id}, -1)" 
                    class="px-2.5 py-1 text-xs font-bold hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <i class="fa-solid fa-minus text-[10px]"></i>
                  </button>
                  <span class="px-2 py-0.5 text-xs font-bold font-sans text-brandGold">${cartQty}</span>
                  <button 
                    onclick="updateCartItemQty(${item.id}, 1)" 
                    class="px-2.5 py-1 text-xs font-bold hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <i class="fa-solid fa-plus text-[10px]"></i>
                  </button>
                </div>
              ` : `
                <button 
                  onclick="updateCartItemQty(${item.id}, 1)" 
                  class="bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 hover:text-brandGold hover:border-brandGold font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1 shadow-sm active:scale-95"
                >
                  <span>Add</span>
                  <i class="fa-solid fa-plus text-[9px] mt-0.5"></i>
                </button>
              `}
            </div>
          </div>

        </div>
      </div>
    `;
  }).join('');
}

// 4. Cart Engine & Reactive Updates
window.updateCartItemQty = function(itemId, change) {
  const item = state.menuItems.find(i => i.id === itemId);
  if (!item) return;

  const currentQty = state.cart[itemId] || 0;
  const newQty = currentQty + change;

  if (newQty <= 0) {
    delete state.cart[itemId];
  } else {
    state.cart[itemId] = newQty;
  }

  // Render updates
  renderMenu();
  renderCartDrawer();
};

// Render the Floating Cart Bottom bar state
function renderCartDrawer() {
  if (!cartDrawer || !cartBadge || !cartTotal || !cartSummaryItems) return;

  let totalItems = 0;
  let totalPrice = 0;
  let summaryHTML = '';

  // Calculate totals and compile summary rows
  for (const [idStr, qty] of Object.entries(state.cart)) {
    const id = parseInt(idStr);
    const item = state.menuItems.find(i => i.id === id);
    
    if (item) {
      totalItems += qty;
      totalPrice += item.price * qty;
      
      summaryHTML += `
        <div class="flex items-center justify-between py-1.5 text-zinc-200">
          <div class="flex flex-col min-w-0 pr-4">
            <span class="font-medium text-xs truncate">${item.name}</span>
            <span class="text-[10px] text-zinc-500">${formatNaira(item.price)} each</span>
          </div>
          <div class="flex items-center gap-2.5 shrink-0">
            <button 
              onclick="updateCartItemQty(${item.id}, -1)" 
              class="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-xs text-white"
            >
              <i class="fa-solid fa-minus text-[9px]"></i>
            </button>
            <span class="text-xs font-bold w-4 text-center text-brandGold">${qty}</span>
            <button 
              onclick="updateCartItemQty(${item.id}, 1)" 
              class="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-xs text-white"
            >
              <i class="fa-solid fa-plus text-[9px]"></i>
            </button>
          </div>
        </div>
      `;
    }
  }

  // Update DOM values
  cartBadge.innerText = totalItems;
  cartTotal.innerText = formatNaira(totalPrice);
  cartSummaryItems.innerHTML = summaryHTML || '<div class="text-zinc-500 text-xs py-2 text-center">Your order is empty</div>';

  // Toggle Cart visibility (Slide-up bottom sheet)
  if (totalItems > 0) {
    cartDrawer.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
    cartDrawer.classList.add('translate-y-0', 'opacity-100');
  } else {
    // Hide details section if empty
    state.isCartExpanded = false;
    cartDetails.classList.add('hidden');
    
    cartDrawer.classList.remove('translate-y-0', 'opacity-100');
    cartDrawer.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
  }
}

// Clear Entire Cart
if (clearCartBtn) {
  clearCartBtn.addEventListener('click', () => {
    state.cart = {};
    renderMenu();
    renderCartDrawer();
  });
}

// Toggle Cart Details summary popover
if (cartToggleBtn) {
  cartToggleBtn.addEventListener('click', () => {
    state.isCartExpanded = !state.isCartExpanded;
    if (state.isCartExpanded) {
      cartDetails.classList.remove('hidden');
    } else {
      cartDetails.classList.add('hidden');
    }
  });
}

// 5. Input handlers: Search bar filter mapping
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    
    // Toggle clear search button visibility
    if (state.searchQuery.length > 0) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }
    
    updateStatusBanner();
    renderMenu();
  });
}

// Clear search handler
if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    updateStatusBanner();
    renderMenu();
  });
}

// Clear Search and Filters Fallback
if (clearFiltersBtnFallback) {
  clearFiltersBtnFallback.addEventListener('click', resetAllFilters);
}
if (resetFiltersBtn) {
  resetFiltersBtn.addEventListener('click', resetAllFilters);
}

function resetAllFilters() {
  if (searchInput) searchInput.value = '';
  state.searchQuery = '';
  if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
  state.activeCategory = 'All Items';
  renderCategories();
  updateStatusBanner();
  renderMenu();
}

// Update Filter & Search feedback banner details
function updateStatusBanner() {
  if (!statusBanner || !statusText) return;

  const hasSearch = state.searchQuery.trim().length > 0;
  const hasCategory = state.activeCategory !== 'All Items';

  if (hasSearch || hasCategory) {
    statusBanner.classList.remove('hidden');
    let msg = '';
    if (hasCategory) msg += `Category: <strong>${state.activeCategory}</strong>`;
    if (hasSearch) {
      if (msg) msg += ' + ';
      msg += `Searching for "<strong>${state.searchQuery}</strong>"`;
    }
    statusText.innerHTML = msg;
  } else {
    statusBanner.classList.add('hidden');
  }
}

// 6. Action Handler: Order via WhatsApp Redirect
if (checkoutBtn) {
  checkoutBtn.addEventListener('click', () => {
    const roomNum = roomInput ? roomInput.value.trim() : '';

    // If Room Number is left blank, elegantly prompt the user to input it
    if (!roomNum) {
      // Direct focus to the input and highlight it to user
      if (roomInput) {
        roomInput.focus();
        roomInput.classList.add('ring-2', 'ring-red-500', 'border-red-500');
        setTimeout(() => {
          roomInput.classList.remove('ring-2', 'ring-red-500', 'border-red-500');
        }, 1500);
      }
      
      // Secondary fallback browser prompt to make sure they provide it
      const promptVal = prompt('Please enter your Room/Villa Number to proceed with the order:');
      if (promptVal !== null && promptVal.trim() !== '') {
        if (roomInput) roomInput.value = promptVal.trim();
        processWhatsAppOrder(promptVal.trim());
      }
    } else {
      processWhatsAppOrder(roomNum);
    }
  });
}

// Formats checkout strings and opens WhatsApp link
function processWhatsAppOrder(roomNumber) {
  let orderText = `*AVERROES VILLA - ORDER REQUEST*\n`;
  orderText += `===============================\n`;
  orderText += `*Room/Villa Number:* Room ${roomNumber}\n`;
  orderText += `*Date:* ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}\n`;
  orderText += `*Time:* ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n`;
  orderText += `===============================\n\n`;
  orderText += `*Order Items:*\n`;

  let totalPrice = 0;

  for (const [idStr, qty] of Object.entries(state.cart)) {
    const id = parseInt(idStr);
    const item = state.menuItems.find(i => i.id === id);
    if (item) {
      const itemSubtotal = item.price * qty;
      totalPrice += itemSubtotal;
      orderText += `• *${qty}x* ${item.name}\n  _Price: ${formatNaira(item.price)} each_ | _Subtotal: ${formatNaira(itemSubtotal)}_\n\n`;
    }
  }

  orderText += `===============================\n`;
  orderText += `*Total Amount:* *${formatNaira(totalPrice)}*\n`;
  orderText += `===============================\n\n`;
  orderText += `_Please tap send to submit this order. The reception desk will confirm your order immediately._`;

  // Encode the message
  const encodedText = encodeURIComponent(orderText);
  const hotelWhatsAppNumber = '2348000000000'; // Target hotel number from prompt specification
  const waUrl = `https://wa.me/${hotelWhatsAppNumber}?text=${encodedText}`;

  // Redirect to WhatsApp in a new tab
  window.open(waUrl, '_blank');
}

// Initialize Application
document.addEventListener('DOMContentLoaded', fetchMenu);
