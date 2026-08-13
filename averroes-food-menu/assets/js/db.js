/**
 * Averroes Restaurant - Local Storage Database Layer
 * Provides a persistent client-side data store using localStorage.
 */
(function (window) {
  'use strict';

  const KEYS = {
    CATEGORIES: 'av_categories',
    CATEGORIES_VERSION: 'av_categories_version',
    MEALS: 'av_meals',
    MEALS_VERSION: 'av_meals_version',
    ORDERS: 'av_orders',
    CHATS: 'av_chats',
    SETTINGS: 'av_settings',
    SETTINGS_VERSION: 'av_settings_version',
    USERS: 'av_users',
    CART: 'av_cart',
    SESSION: 'av_session',
    EXPENSES: 'av_expenses',
    TRANSACTIONS: 'av_transactions',
    AUDIT: 'av_audit'
  };

  const CATEGORIES_SEED_VERSION = 4;
  const MEALS_SEED_VERSION = 4;
  const SETTINGS_SEED_VERSION = 2;

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Storage read error', e);
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage write error', e);
      return false;
    }
  }

  function migrateUsers() {
    const seedUsers = window.AVERROES_DATA.users;
    const seedByName = new Map(seedUsers.map(u => [u.username, u]));
    const users = get(KEYS.USERS, []);
    const canonical = [];
    const seen = new Set();

    for (const u of users) {
      if (u.username === 'admin_ave') {
        if (users.some(x => x.username === 'ave_admin')) continue;
        u.username = 'ave_admin';
      }
      if (u.username === 'ave_admin') {
        const seed = seedByName.get('ave_admin');
        if (seed) { u.password = seed.password; u.role = 'staff'; u.disabled = false; }
        if (!seen.has('ave_admin')) { canonical.push(u); seen.add('ave_admin'); }
      } else if (u.username === 'manager_admin') {
        const seed = seedByName.get('manager_admin');
        if (seed) { u.password = seed.password; u.role = 'manager'; u.disabled = false; }
        if (!seen.has('manager_admin')) { canonical.push(u); seen.add('manager_admin'); }
      } else {
        canonical.push(u);
      }
    }

    if (!seen.has('ave_admin')) {
      const seed = seedByName.get('ave_admin');
      if (seed) { canonical.push({ ...seed }); seen.add('ave_admin'); }
    }
    if (!seen.has('manager_admin')) {
      const seed = seedByName.get('manager_admin');
      if (seed) { canonical.push({ ...seed }); seen.add('manager_admin'); }
    }

    set(KEYS.USERS, canonical);
  }

  function init() {
    if (!get(KEYS.SETTINGS) || get(KEYS.SETTINGS_VERSION) !== SETTINGS_SEED_VERSION) {
      set(KEYS.SETTINGS, window.AVERROES_DATA.settings);
      set(KEYS.SETTINGS_VERSION, SETTINGS_SEED_VERSION);
    }
    if (!get(KEYS.CATEGORIES) || get(KEYS.CATEGORIES_VERSION) !== CATEGORIES_SEED_VERSION) {
      set(KEYS.CATEGORIES, window.AVERROES_DATA.categories);
      set(KEYS.CATEGORIES_VERSION, CATEGORIES_SEED_VERSION);
    }
    if (!get(KEYS.MEALS) || get(KEYS.MEALS_VERSION) !== MEALS_SEED_VERSION) {
      set(KEYS.MEALS, window.AVERROES_DATA.meals);
      set(KEYS.MEALS_VERSION, MEALS_SEED_VERSION);
    }
    if (!get(KEYS.ORDERS)) {
      set(KEYS.ORDERS, window.AVERROES_DATA.orders);
    }
    if (!get(KEYS.CHATS)) {
      set(KEYS.CHATS, []);
    }
    if (!get(KEYS.USERS)) {
      set(KEYS.USERS, window.AVERROES_DATA.users);
    }
    migrateUsers();
    if (!get(KEYS.CART)) {
      set(KEYS.CART, {});
    }
    if (!get(KEYS.EXPENSES)) {
      set(KEYS.EXPENSES, []);
    }
    if (!get(KEYS.TRANSACTIONS)) {
      set(KEYS.TRANSACTIONS, []);
    }
    if (!get(KEYS.AUDIT)) {
      set(KEYS.AUDIT, []);
    }
  }

  function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async function hashPassword(password) {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(String(password)).digest('hex');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(String(password));
    const buf = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const DB = {
    init,

    getSettings() { return { ...window.AVERROES_DATA.settings, ...get(KEYS.SETTINGS, {}) }; },
    saveSettings(settings) { return set(KEYS.SETTINGS, settings); },

    getCategories() { return get(KEYS.CATEGORIES, window.AVERROES_DATA.categories); },
    saveCategories(categories) { return set(KEYS.CATEGORIES, categories); },
    getCategoryById(id) { return this.getCategories().find(c => c.id === id); },

    addCategory(title, subtitle) {
      const categories = this.getCategories();
      let id = slugify(title);
      if (!id) return null;
      if (categories.some(c => c.id === id)) {
        id = id + '-' + Math.random().toString(36).slice(2, 6);
      }
      const maxOrder = categories.reduce((max, c) => Math.max(max, c.order || 0), 0);
      const cat = { id, title: title.trim(), subtitle: (subtitle || '').trim(), order: maxOrder + 1 };
      categories.push(cat);
      this.saveCategories(categories);
      return cat;
    },

    updateCategory(id, updates) {
      const categories = this.getCategories();
      const idx = categories.findIndex(c => c.id === id);
      if (idx === -1) return null;
      categories[idx] = { ...categories[idx], ...updates };
      this.saveCategories(categories);
      return categories[idx];
    },

    deleteCategory(id) {
      const categories = this.getCategories().filter(c => c.id !== id);
      this.saveCategories(categories);
      const meals = this.getMeals().filter(m => m.categoryId !== id);
      this.saveMeals(meals);
    },

    getMeals() { return get(KEYS.MEALS, window.AVERROES_DATA.meals); },
    saveMeals(meals) { return set(KEYS.MEALS, meals); },

    getMealById(id) { return this.getMeals().find(m => m.id === id); },
    getMealsByCategory(categoryId) { return this.getMeals().filter(m => m.categoryId === categoryId); },

    addMeal(meal) {
      const meals = this.getMeals();
      const newMeal = { ...meal, id: meal.id || uuid(), createdAt: new Date().toISOString() };
      meals.push(newMeal);
      this.saveMeals(meals);
      return newMeal;
    },

    updateMeal(id, updates) {
      const meals = this.getMeals();
      const idx = meals.findIndex(m => m.id === id);
      if (idx === -1) return null;
      meals[idx] = { ...meals[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveMeals(meals);
      return meals[idx];
    },

    deleteMeal(id) {
      const meals = this.getMeals().filter(m => m.id !== id);
      this.saveMeals(meals);
    },

    duplicateMeal(id) {
      const meal = this.getMealById(id);
      if (!meal) return null;
      const copy = { ...meal, id: uuid(), name: `${meal.name} (Copy)`, createdAt: new Date().toISOString() };
      const meals = this.getMeals();
      const idx = meals.findIndex(m => m.id === id);
      meals.splice(idx + 1, 0, copy);
      this.saveMeals(meals);
      return copy;
    },

    moveMeal(id, categoryId) {
      return this.updateMeal(id, { categoryId });
    },

    toggleMealFlag(id, flag) {
      const meal = this.getMealById(id);
      if (!meal) return null;
      return this.updateMeal(id, { [flag]: !meal[flag] });
    },

    getCart() { return get(KEYS.CART, {}); },
    saveCart(cart) { return set(KEYS.CART, cart); },

    getChats() { return get(KEYS.CHATS, []); },
    saveChats(chats) { return set(KEYS.CHATS, chats); },
    getConversation(id) { return this.getChats().find(c => c.id === id); },
    getConversationsForCustomer(customerId) { return this.getChats().filter(c => c.customerId === customerId).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)); },
    createChat(customerId, orderId, location, identifier) {
      const chats = this.getChats();
      const existing = orderId ? chats.find(c => c.orderId === orderId && c.customerId === customerId) : null;
      if (existing) return existing;
      const chat = { id: uuid(), customerId, orderId: orderId || null, location: location || '', identifier: identifier || '', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      chats.unshift(chat);
      this.saveChats(chats);
      return chat;
    },
    addMessage(chatId, sender, text, messageType = 'text', metadata = null) {
      const chats = this.getChats();
      const chat = chats.find(c => c.id === chatId);
      if (!chat) return null;
      chat.messages.push({
        id: uuid(),
        sender,
        text,
        messageType,
        metadata,
        readBy: [sender],
        createdAt: new Date().toISOString()
      });
      chat.updatedAt = new Date().toISOString();
      this.saveChats(chats);
      return chat;
    },
    markMessagesAsRead(chatId, recipient) {
      const chats = this.getChats();
      const chat = chats.find(c => c.id === chatId);
      if (!chat) return null;
      chat.messages.forEach(m => {
        if (m.sender !== recipient && !m.readBy.includes(recipient)) {
          m.readBy.push(recipient);
        }
      });
      this.saveChats(chats);
      return chat;
    },
    getUnreadCountForCustomer(customerId) {
      return this.getConversationsForCustomer(customerId).reduce((sum, c) => {
        return sum + c.messages.filter(m => m.sender !== 'customer' && !m.readBy.includes('customer')).length;
      }, 0);
    },
    getUnreadCountForChat(chatId) {
      const chat = this.getConversation(chatId);
      if (!chat) return 0;
      return chat.messages.filter(m => m.sender === 'customer' && !m.readBy.includes('admin')).length;
    },
    getTotalUnreadCountForAdmin() {
      return this.getChats().reduce((sum, c) => {
        return sum + c.messages.filter(m => m.sender === 'customer' && !m.readBy.includes('admin')).length;
      }, 0);
    },

    addOrder(order) {
      const orders = this.getOrders();
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;
      const prefix = `ORD-${year}-${month}-`;
      const monthOrders = orders.filter(o => o.orderNumber && o.orderNumber.startsWith(prefix));
      const nextSeq = monthOrders.reduce((max, o) => {
        const match = o.orderNumber.match(/-(\d{3})$/);
        const n = match ? parseInt(match[1], 10) : 0;
        return Math.max(max, n);
      }, 0) + 1;
      const orderNumber = `${prefix}${String(nextSeq).padStart(3, '0')}`;

      const snapshot = [];
      let total = 0;
      Object.entries(order.items || {}).forEach(([id, qty]) => {
        const meal = this.getMealById(id);
        if (!meal || qty <= 0) return;
        snapshot.push({ id, name: meal.name, price: meal.price, qty, categoryId: meal.categoryId });
        total += meal.price * qty;
      });

      const newOrder = {
        ...order,
        id: uuid(),
        customerId: order.customerId || null,
        orderNumber,
        monthKey,
        createdAt: now.toISOString(),
        status: 'PENDING',
        items: snapshot,
        total,
        confirmedAt: null,
        completedAt: null
      };
      orders.unshift(newOrder);
      this.saveOrders(orders);
      if (newOrder.customerId) {
        this.createChat(newOrder.customerId, newOrder.id, newOrder.location, newOrder.identifier);
      }
      return newOrder;
    },
    getOrders() { return get(KEYS.ORDERS, []); },
    saveOrders(orders) { return set(KEYS.ORDERS, orders); },
    getOrderById(id) { return this.getOrders().find(o => o.id === id); },
    async adminUpdateOrderStatus(id, status) {
      const session = this.getSession();
      if (!this.isStaff()) return { error: 'unauthorized' };
      const allowedForStaff = ['PENDING', 'NEW', 'CONFIRMED', 'COMPLETED'];
      if (session.role === 'staff' && status === 'CANCELLED') return { error: 'staff cannot cancel' };
      if (session.role === 'staff' && !allowedForStaff.includes(status)) return { error: 'unauthorized' };
      const order = this.getOrderById(id);
      if (!order) return { error: 'not found' };
      const updates = { status };
      if (status === 'CONFIRMED') updates.confirmedAt = new Date().toISOString();
      if (status === 'COMPLETED') updates.completedAt = new Date().toISOString();
      const orders = this.getOrders();
      const idx = orders.findIndex(o => o.id === id);
      orders[idx] = { ...orders[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveOrders(orders);
      return { success: true, order: orders[idx] };
    },
    adminDeleteOrder(id) {
      const session = this.getSession();
      if (!this.isManager()) return { error: 'manager only' };
      const order = this.getOrderById(id);
      if (!order) return { error: 'not found' };
      const orders = this.getOrders().filter(o => o.id !== id);
      this.saveOrders(orders);
      this.addAuditLog({
        action: 'ORDER_DELETED',
        actor: session.username,
        actorId: session.id,
        orderId: id,
        orderNumber: order.orderNumber,
        result: 'success'
      });
      return { success: true };
    },
    adminCancelOrder(id) {
      const session = this.getSession();
      if (!this.isManager()) return { error: 'manager only' };
      const order = this.getOrderById(id);
      if (!order) return { error: 'not found' };
      if (order.status === 'COMPLETED') return { error: 'already completed' };
      const orders = this.getOrders();
      const idx = orders.findIndex(o => o.id === id);
      orders[idx] = { ...orders[idx], status: 'CANCELLED', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      this.saveOrders(orders);
      this.addAuditLog({
        action: 'ORDER_CANCELLED',
        actor: session.username,
        actorId: session.id,
        orderId: id,
        orderNumber: order.orderNumber,
        result: 'success'
      });
      return { success: true, order: orders[idx] };
    },
    addAuditLog(record) {
      const logs = this.getAuditLogs();
      logs.unshift({ id: uuid(), createdAt: new Date().toISOString(), ...record });
      set(KEYS.AUDIT, logs);
      return logs[0];
    },
    getAuditLogs() { return get(KEYS.AUDIT, []); },

    getUsers() { return get(KEYS.USERS, window.AVERROES_DATA.users); },
    saveUsers(users) { return set(KEYS.USERS, users); },
    getSession() { return get(KEYS.SESSION); },
    isManager() {
      const s = this.getSession();
      return !!s && s.role === 'manager';
    },
    isStaff() {
      const s = this.getSession();
      return !!s && (s.role === 'staff' || s.role === 'manager');
    },
    async addUser(username, password, role = 'staff', displayName = '') {
      if (!this.isStaff()) return null;
      if (role === 'manager' && !this.isManager()) return null;
      const users = this.getUsers();
      if (users.some(u => u.username === username)) return null;
      const hash = await hashPassword(password);
      const user = { id: uuid(), username, password: hash, role, displayName: (displayName || '').trim(), disabled: false, createdAt: new Date().toISOString() };
      users.push(user);
      this.saveUsers(users);
      return user;
    },
    async updateUser(id, updates) {
      const users = this.getUsers();
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return null;
      const target = users[idx];
      if (target.username === 'manager_admin' && !this.isManager()) return null;
      if (target.username === 'manager_admin' && updates.username && updates.username !== 'manager_admin') return null;
      if (updates.role === 'manager' && !this.isManager()) return null;
      if (target.username === 'manager_admin' && updates.role && updates.role !== 'manager') return null;
      if (updates.password) updates.password = await hashPassword(updates.password);
      users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveUsers(users);
      return users[idx];
    },
    deleteUser(id) {
      const users = this.getUsers();
      const target = users.find(u => u.id === id);
      if (!target) return false;
      if (target.username === 'manager_admin') return false;
      if (target.role === 'manager' && !this.isManager()) return false;
      if (users.filter(u => !u.disabled).length <= 1) return false;
      const remaining = users.filter(u => u.id !== id);
      this.saveUsers(remaining);
      return true;
    },
    toggleUserDisabled(id) {
      const users = this.getUsers();
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return null;
      const target = users[idx];
      if (target.username === 'manager_admin') return null;
      if (target.role === 'manager' && !this.isManager()) return null;
      users[idx].disabled = !users[idx].disabled;
      users[idx].updatedAt = new Date().toISOString();
      this.saveUsers(users);
      return users[idx];
    },
    async login(username, password) {
      const users = this.getUsers();
      const hash = await hashPassword(password);
      const user = users.find(u => u.username === username && u.password === hash && !u.disabled);
      if (user) {
        set(KEYS.SESSION, { id: user.id, username: user.username, role: user.role, loggedInAt: new Date().toISOString() });
        return true;
      }
      return false;
    },
    logout() { localStorage.removeItem(KEYS.SESSION); },
    isLoggedIn() { return !!get(KEYS.SESSION); },

    exportAll() {
      const settings = { ...this.getSettings() };
      delete settings.adminPassword;
      return {
        settings,
        categories: this.getCategories(),
        meals: this.getMeals(),
        orders: this.getOrders(),
        chats: this.getChats(),
        users: this.getUsers().map(u => { const s = { ...u }; delete s.password; return s; }),
        cart: this.getCart(),
        audit: this.getAuditLogs()
      };
    },

    importAll(data) {
      if (data.settings) set(KEYS.SETTINGS, data.settings);
      if (data.categories) set(KEYS.CATEGORIES, data.categories);
      if (data.meals) set(KEYS.MEALS, data.meals);
      if (data.orders) set(KEYS.ORDERS, data.orders);
      if (data.chats) set(KEYS.CHATS, data.chats);
      if (data.users) set(KEYS.USERS, data.users);
      if (data.cart) set(KEYS.CART, data.cart);
      if (data.audit) set(KEYS.AUDIT, data.audit);
    },

    getExpenses() { return get(KEYS.EXPENSES, []); },
    saveExpenses(expenses) { return set(KEYS.EXPENSES, expenses); },
    addExpense(expense) {
      const expenses = this.getExpenses();
      const newExpense = {
        id: uuid(),
        description: expense.description || '',
        category: expense.category || 'General',
        amount: parseFloat(expense.amount) || 0,
        paymentMethod: expense.paymentMethod || 'Cash',
        notes: expense.notes || '',
        createdBy: expense.createdBy || 'admin',
        createdAt: new Date().toISOString()
      };
      expenses.unshift(newExpense);
      this.saveExpenses(expenses);
      this.addTransaction({
        type: 'EXPENSE',
        description: newExpense.description,
        amount: newExpense.amount,
        relatedId: newExpense.id,
        category: newExpense.category
      });
      return newExpense;
    },
    updateExpense(id, updates) {
      const expenses = this.getExpenses();
      const idx = expenses.findIndex(e => e.id === id);
      if (idx === -1) return null;
      expenses[idx] = { ...expenses[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveExpenses(expenses);
      return expenses[idx];
    },
    deleteExpense(id) {
      const expenses = this.getExpenses().filter(e => e.id !== id);
      this.saveExpenses(expenses);
    },

    getTransactions() { return get(KEYS.TRANSACTIONS, []); },
    saveTransactions(transactions) { return set(KEYS.TRANSACTIONS, transactions); },
    addTransaction(transaction) {
      const transactions = this.getTransactions();
      const newTransaction = {
        id: uuid(),
        type: transaction.type || 'OTHER',
        description: transaction.description || '',
        amount: parseFloat(transaction.amount) || 0,
        relatedId: transaction.relatedId || null,
        category: transaction.category || '',
        paymentMethod: transaction.paymentMethod || '',
        status: transaction.status || 'COMPLETED',
        createdAt: new Date().toISOString()
      };
      transactions.unshift(newTransaction);
      this.saveTransactions(transactions);
      return newTransaction;
    },

    resetToSeed() {
      set(KEYS.SETTINGS, window.AVERROES_DATA.settings);
      set(KEYS.SETTINGS_VERSION, SETTINGS_SEED_VERSION);
      set(KEYS.CATEGORIES, window.AVERROES_DATA.categories);
      set(KEYS.CATEGORIES_VERSION, CATEGORIES_SEED_VERSION);
      set(KEYS.MEALS, window.AVERROES_DATA.meals);
      set(KEYS.MEALS_VERSION, MEALS_SEED_VERSION);
      set(KEYS.ORDERS, window.AVERROES_DATA.orders);
      set(KEYS.USERS, window.AVERROES_DATA.users);
      set(KEYS.CART, {});
      set(KEYS.EXPENSES, []);
      set(KEYS.TRANSACTIONS, []);
      set(KEYS.AUDIT, []);
    }
  };

  DB.slugify = slugify;
  DB.uuid = uuid;
  window.AverroesDB = DB;
  init();
})(window);
