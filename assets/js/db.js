/**
 * Averroes Restaurant - Supabase Database Layer
 * Drop-in replacement for the localStorage-based db.js.
 * All external method signatures are preserved — customer.js and admin.js require ZERO changes.
 *
 * Architecture:
 *  - On init(), all data is fetched from Supabase into an in-memory cache.
 *  - Read methods return from cache (synchronous, instant).
 *  - Write methods update cache AND push to Supabase (async fire-and-forget).
 *  - Supabase Realtime subscriptions keep cache in sync across devices.
 *  - Cart, session, and customer ID remain in localStorage (device-specific by design).
 */
(function (window) {
  'use strict';

  const sb = window.AverroesSupabase;
  const AUTH_EMAIL_DOMAIN = '@averroes.local';

  // In-memory cache — populated on init, kept in sync via Realtime
  const cache = {
    categories: [],
    meals: [],
    orders: [],
    chats: [],       // chats with messages nested (for API compatibility)
    settings: {},
    users: [],
    expenses: [],
    transactions: [],
    audit: [],
    _ready: false,
    _initPromise: null
  };

  // localStorage keys (only for device-specific data)
  const LOCAL_KEYS = {
    CART: 'av_cart',
    SESSION: 'av_session',
    CUSTOMER_ID: 'av_customer_id'
  };

  // ─── Helpers ───

  function localGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function localSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
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
    const encoder = new TextEncoder();
    const data = encoder.encode(String(password));
    const buf = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ─── Supabase Data Fetchers ───

  async function fetchCategories() {
    const { data, error } = await sb.from('categories').select('*').order('order', { ascending: true });
    if (error) { console.error('Fetch categories error:', error); return; }
    cache.categories = (data || []).map(row => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle || '',
      order: row.order || 0
    }));
  }

  async function fetchMeals() {
    const { data, error } = await sb.from('meals').select('*');
    if (error) { console.error('Fetch meals error:', error); return; }
    cache.meals = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      categoryId: row.category_id,
      price: parseFloat(row.price) || 0,
      image: row.image || '',
      available: row.available !== false,
      outOfStock: row.out_of_stock === true,
      hidden: row.hidden === true,
      description: row.description || '',
      prepTime: row.prep_time || '',
      isChefSpecial: row.is_chef_special === true,
      isPopular: row.is_popular === true,
      isTodaysSpecial: row.is_todays_special === true,
      isChefRecommendation: row.is_chef_recommendation === true,
      mealTypes: row.meal_types || [],
      tags: row.tags || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async function fetchOrders() {
    const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Fetch orders error:', error); return; }
    cache.orders = (data || []).map(row => ({
      id: row.id,
      customerId: row.customer_id,
      orderNumber: row.order_number,
      monthKey: row.month_key,
      location: row.location || '',
      identifier: row.identifier || '',
      method: row.method || 'direct',
      items: row.items || [],
      total: parseFloat(row.total) || 0,
      status: row.status || 'PENDING',
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      updatedAt: row.updated_at
    }));
  }

  async function fetchChatsWithMessages() {
    const { data: chatRows, error: chatErr } = await sb.from('chats').select('*').order('updated_at', { ascending: false });
    if (chatErr) { console.error('Fetch chats error:', chatErr); return; }
    const { data: msgRows, error: msgErr } = await sb.from('messages').select('*').order('created_at', { ascending: true });
    if (msgErr) { console.error('Fetch messages error:', msgErr); return; }

    const msgMap = {};
    (msgRows || []).forEach(m => {
      if (!msgMap[m.chat_id]) msgMap[m.chat_id] = [];
      msgMap[m.chat_id].push({
        id: m.id,
        sender: m.sender,
        text: m.text,
        messageType: m.message_type || 'text',
        metadata: m.metadata,
        readBy: m.read_by || [],
        createdAt: m.created_at
      });
    });

    cache.chats = (chatRows || []).map(row => ({
      id: row.id,
      customerId: row.customer_id,
      orderId: row.order_id,
      location: row.location || '',
      identifier: row.identifier || '',
      messages: msgMap[row.id] || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async function fetchSettings() {
    const { data, error } = await sb.from('settings').select('*').eq('id', 'main').single();
    if (error || !data) {
      cache.settings = window.AVERROES_DATA ? { ...window.AVERROES_DATA.settings } : {};
      return;
    }
    cache.settings = {
      restaurantName: data.restaurant_name || 'Averroes Restaurant',
      tagline: data.tagline || 'Luxury Hotel Dining',
      address: data.address || '',
      currency: data.currency || '₦',
      locale: data.locale || 'en-NG',
      logoUrl: data.logo_url || ''
    };
  }

  async function fetchUsers() {
    const { data, error } = await sb.from('users').select('*');
    if (error) { console.error('Fetch users error:', error); return; }
    cache.users = (data || []).map(row => ({
      id: row.id,
      username: row.username,
      role: row.role || 'staff',
      displayName: row.display_name || '',
      disabled: row.disabled === true,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async function fetchExpenses() {
    const { data, error } = await sb.from('expenses').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Fetch expenses error:', error); return; }
    cache.expenses = (data || []).map(row => ({
      id: row.id,
      description: row.description || '',
      category: row.category || 'General',
      amount: parseFloat(row.amount) || 0,
      paymentMethod: row.payment_method || 'Cash',
      notes: row.notes || '',
      createdBy: row.created_by || 'admin',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async function fetchTransactions() {
    const { data, error } = await sb.from('transactions').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Fetch transactions error:', error); return; }
    cache.transactions = (data || []).map(row => ({
      id: row.id,
      type: row.type || 'OTHER',
      description: row.description || '',
      amount: parseFloat(row.amount) || 0,
      relatedId: row.related_id,
      category: row.category || '',
      paymentMethod: row.payment_method || '',
      status: row.status || 'COMPLETED',
      createdAt: row.created_at
    }));
  }

  async function fetchAuditLogs() {
    const { data, error } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Fetch audit logs error:', error); return; }
    cache.audit = (data || []).map(row => ({
      id: row.id,
      action: row.action,
      actor: row.actor,
      actorId: row.actor_id,
      orderId: row.order_id,
      orderNumber: row.order_number,
      result: row.result || 'success',
      createdAt: row.created_at
    }));
  }

  // ─── Realtime Subscriptions ───

  function setupRealtime() {
    // Orders channel
    sb.channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders().catch(console.error);
      })
      .subscribe();

    // Messages channel
    sb.channel('messages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchChatsWithMessages().catch(console.error);
      })
      .subscribe();

    // Chats channel
    sb.channel('chats-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
        fetchChatsWithMessages().catch(console.error);
      })
      .subscribe();

    // Meals channel
    sb.channel('meals-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meals' }, () => {
        fetchMeals().catch(console.error);
      })
      .subscribe();

    // Categories channel
    sb.channel('categories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchCategories().catch(console.error);
      })
      .subscribe();

    // Settings channel
    sb.channel('settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
        fetchSettings().catch(console.error);
      })
      .subscribe();
  }

  // ─── Init ───

  async function init() {
    if (cache._initPromise) return cache._initPromise;

    cache._initPromise = (async () => {
      try {
        await Promise.all([
          fetchCategories(),
          fetchMeals(),
          fetchOrders(),
          fetchChatsWithMessages(),
          fetchSettings(),
          fetchUsers(),
          fetchExpenses(),
          fetchTransactions(),
          fetchAuditLogs()
        ]);
        cache._ready = true;
        setupRealtime();
        console.log('✅ AverroesDB connected to Supabase');
      } catch (err) {
        console.error('⚠️ Supabase init failed, falling back to seed data:', err);
        // Graceful degradation: use seed data
        if (window.AVERROES_DATA) {
          cache.categories = window.AVERROES_DATA.categories || [];
          cache.meals = window.AVERROES_DATA.meals || [];
          cache.settings = window.AVERROES_DATA.settings || {};
          cache.users = window.AVERROES_DATA.users || [];
          cache.orders = window.AVERROES_DATA.orders || [];
        }
        cache._ready = true;
      }
    })();

    return cache._initPromise;
  }

  // ─── DB Object (public API — identical signatures to the old localStorage version) ───

  const DB = {
    init,

    // ── Settings ──
    getSettings() {
      const seed = window.AVERROES_DATA ? window.AVERROES_DATA.settings : {};
      return { ...seed, ...cache.settings };
    },

    saveSettings(settings) {
      cache.settings = { ...settings };
      sb.from('settings').upsert({
        id: 'main',
        restaurant_name: settings.restaurantName || '',
        tagline: settings.tagline || '',
        address: settings.address || '',
        currency: settings.currency || '₦',
        locale: settings.locale || 'en-NG',
        logo_url: settings.logoUrl || ''
      }).then(({ error }) => { if (error) console.error('Save settings error:', error); });
      return true;
    },

    // ── Categories ──
    getCategories() { return cache.categories.slice(); },

    saveCategories(categories) {
      cache.categories = categories.slice();
      return true;
    },

    getCategoryById(id) { return cache.categories.find(c => c.id === id); },

    addCategory(title, subtitle) {
      const categories = cache.categories;
      let id = slugify(title);
      if (!id) return null;
      if (categories.some(c => c.id === id)) {
        id = id + '-' + Math.random().toString(36).slice(2, 6);
      }
      const maxOrder = categories.reduce((max, c) => Math.max(max, c.order || 0), 0);
      const cat = { id, title: title.trim(), subtitle: (subtitle || '').trim(), order: maxOrder + 1 };
      cache.categories.push(cat);

      sb.from('categories').insert({
        id: cat.id,
        title: cat.title,
        subtitle: cat.subtitle,
        order: cat.order
      }).then(({ error }) => { if (error) console.error('Add category error:', error); });

      return cat;
    },

    updateCategory(id, updates) {
      const idx = cache.categories.findIndex(c => c.id === id);
      if (idx === -1) return null;
      cache.categories[idx] = { ...cache.categories[idx], ...updates };

      const row = {};
      if (updates.title !== undefined) row.title = updates.title;
      if (updates.subtitle !== undefined) row.subtitle = updates.subtitle;
      if (updates.order !== undefined) row.order = updates.order;
      sb.from('categories').update(row).eq('id', id)
        .then(({ error }) => { if (error) console.error('Update category error:', error); });

      return cache.categories[idx];
    },

    deleteCategory(id) {
      cache.categories = cache.categories.filter(c => c.id !== id);
      cache.meals = cache.meals.filter(m => m.categoryId !== id);

      sb.from('categories').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Delete category error:', error); });
    },

    // ── Meals ──
    getMeals() { return cache.meals.slice(); },

    saveMeals(meals) {
      cache.meals = meals.slice();
      return true;
    },

    getMealById(id) { return cache.meals.find(m => m.id === id); },

    getMealsByCategory(categoryId) { return cache.meals.filter(m => m.categoryId === categoryId); },

    addMeal(meal) {
      const newMeal = { ...meal, id: meal.id || uuid(), createdAt: new Date().toISOString() };
      cache.meals.push(newMeal);

      sb.from('meals').insert({
        id: newMeal.id,
        name: newMeal.name,
        category_id: newMeal.categoryId,
        price: newMeal.price,
        image: newMeal.image || '',
        available: newMeal.available !== false,
        out_of_stock: newMeal.outOfStock === true,
        hidden: newMeal.hidden === true,
        description: newMeal.description || '',
        prep_time: newMeal.prepTime || '',
        is_chef_special: newMeal.isChefSpecial === true,
        is_popular: newMeal.isPopular === true,
        is_todays_special: newMeal.isTodaysSpecial === true,
        is_chef_recommendation: newMeal.isChefRecommendation === true,
        meal_types: newMeal.mealTypes || [],
        tags: newMeal.tags || []
      }).then(({ error }) => { if (error) console.error('Add meal error:', error); });

      return newMeal;
    },

    updateMeal(id, updates) {
      const idx = cache.meals.findIndex(m => m.id === id);
      if (idx === -1) return null;
      cache.meals[idx] = { ...cache.meals[idx], ...updates, updatedAt: new Date().toISOString() };

      const row = {};
      if (updates.name !== undefined) row.name = updates.name;
      if (updates.categoryId !== undefined) row.category_id = updates.categoryId;
      if (updates.price !== undefined) row.price = updates.price;
      if (updates.image !== undefined) row.image = updates.image;
      if (updates.available !== undefined) row.available = updates.available;
      if (updates.outOfStock !== undefined) row.out_of_stock = updates.outOfStock;
      if (updates.hidden !== undefined) row.hidden = updates.hidden;
      if (updates.description !== undefined) row.description = updates.description;
      row.updated_at = new Date().toISOString();

      sb.from('meals').update(row).eq('id', id)
        .then(({ error }) => { if (error) console.error('Update meal error:', error); });

      return cache.meals[idx];
    },

    deleteMeal(id) {
      cache.meals = cache.meals.filter(m => m.id !== id);
      sb.from('meals').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Delete meal error:', error); });
    },

    duplicateMeal(id) {
      const meal = this.getMealById(id);
      if (!meal) return null;
      const copy = { ...meal, id: uuid(), name: `${meal.name} (Copy)`, createdAt: new Date().toISOString() };
      return this.addMeal(copy);
    },

    moveMeal(id, categoryId) {
      return this.updateMeal(id, { categoryId });
    },

    toggleMealFlag(id, flag) {
      const meal = this.getMealById(id);
      if (!meal) return null;
      return this.updateMeal(id, { [flag]: !meal[flag] });
    },

    // ── Cart (stays in localStorage — device-specific) ──
    getCart() { return localGet(LOCAL_KEYS.CART, {}); },
    saveCart(cart) { return localSet(LOCAL_KEYS.CART, cart); },

    // ── Chats ──
    getChats() { return cache.chats.slice(); },

    saveChats(chats) {
      cache.chats = chats.slice();
      return true;
    },

    getConversation(id) { return cache.chats.find(c => c.id === id); },

    getConversationsForCustomer(customerId) {
      return cache.chats.filter(c => c.customerId === customerId)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    },

    createChat(customerId, orderId, location, identifier) {
      const existing = orderId ? cache.chats.find(c => c.orderId === orderId && c.customerId === customerId) : null;
      if (existing) return existing;

      const chatId = uuid();
      const now = new Date().toISOString();
      const chat = {
        id: chatId,
        customerId,
        orderId: orderId || null,
        location: location || '',
        identifier: identifier || '',
        messages: [],
        createdAt: now,
        updatedAt: now
      };
      cache.chats.unshift(chat);

      sb.from('chats').insert({
        id: chatId,
        customer_id: customerId,
        order_id: orderId || null,
        location: location || '',
        identifier: identifier || '',
        created_at: now,
        updated_at: now
      }).then(({ error }) => { if (error) console.error('Create chat error:', error); });

      return chat;
    },

    addMessage(chatId, sender, text, messageType, metadata) {
      messageType = messageType || 'text';
      metadata = metadata || null;

      const chat = cache.chats.find(c => c.id === chatId);
      if (!chat) return null;

      const msgId = uuid();
      const now = new Date().toISOString();
      const msg = {
        id: msgId,
        sender,
        text,
        messageType,
        metadata,
        readBy: [sender],
        createdAt: now
      };
      chat.messages.push(msg);
      chat.updatedAt = now;

      // Insert message
      sb.from('messages').insert({
        id: msgId,
        chat_id: chatId,
        sender,
        text,
        message_type: messageType,
        metadata,
        read_by: [sender],
        created_at: now
      }).then(({ error }) => { if (error) console.error('Add message error:', error); });

      // Update chat timestamp
      sb.from('chats').update({ updated_at: now }).eq('id', chatId)
        .then(({ error }) => { if (error) console.error('Update chat timestamp error:', error); });

      return chat;
    },

    markMessagesAsRead(chatId, recipient) {
      const chat = cache.chats.find(c => c.id === chatId);
      if (!chat) return null;

      const updatedMsgIds = [];
      chat.messages.forEach(m => {
        if (m.sender !== recipient && !m.readBy.includes(recipient)) {
          m.readBy.push(recipient);
          updatedMsgIds.push(m.id);
        }
      });

      // Batch update read_by in Supabase
      if (updatedMsgIds.length > 0) {
        updatedMsgIds.forEach(msgId => {
          const msg = chat.messages.find(m => m.id === msgId);
          if (msg) {
            sb.from('messages').update({ read_by: msg.readBy }).eq('id', msgId)
              .then(({ error }) => { if (error) console.error('Mark read error:', error); });
          }
        });
      }

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
      return cache.chats.reduce((sum, c) => {
        return sum + c.messages.filter(m => m.sender === 'customer' && !m.readBy.includes('admin')).length;
      }, 0);
    },

    // ── Orders ──
    addOrder(order) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;
      const prefix = `ORD-${year}-${month}-`;
      const monthOrders = cache.orders.filter(o => o.orderNumber && o.orderNumber.startsWith(prefix));
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

      const orderId = uuid();
      const newOrder = {
        ...order,
        id: orderId,
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
      cache.orders.unshift(newOrder);

      sb.from('orders').insert({
        id: orderId,
        customer_id: newOrder.customerId,
        order_number: orderNumber,
        month_key: monthKey,
        location: newOrder.location || '',
        identifier: newOrder.identifier || '',
        method: newOrder.method || 'direct',
        items: snapshot,
        total,
        status: 'PENDING',
        created_at: now.toISOString()
      }).then(({ error }) => { if (error) console.error('Add order error:', error); });

      if (newOrder.customerId) {
        this.createChat(newOrder.customerId, newOrder.id, newOrder.location, newOrder.identifier);
      }

      return newOrder;
    },

    getOrders() { return cache.orders.slice(); },

    saveOrders(orders) {
      cache.orders = orders.slice();
      return true;
    },

    getOrderById(id) { return cache.orders.find(o => o.id === id); },

    async adminUpdateOrderStatus(id, status) {
      const session = this.getSession();
      if (!this.isStaff()) return { error: 'unauthorized' };
      const allowedForStaff = ['PENDING', 'NEW', 'CONFIRMED', 'COMPLETED'];
      if (session.role === 'staff' && status === 'CANCELLED') return { error: 'staff cannot cancel' };
      if (session.role === 'staff' && !allowedForStaff.includes(status)) return { error: 'unauthorized' };

      const idx = cache.orders.findIndex(o => o.id === id);
      if (idx === -1) return { error: 'not found' };

      const updates = { status };
      if (status === 'CONFIRMED') updates.confirmedAt = new Date().toISOString();
      if (status === 'COMPLETED') updates.completedAt = new Date().toISOString();

      cache.orders[idx] = { ...cache.orders[idx], ...updates, updatedAt: new Date().toISOString() };

      const row = { status, updated_at: new Date().toISOString() };
      if (updates.confirmedAt) row.confirmed_at = updates.confirmedAt;
      if (updates.completedAt) row.completed_at = updates.completedAt;

      const { error } = await sb.from('orders').update(row).eq('id', id);
      if (error) console.error('Update order status error:', error);

      return { success: true, order: cache.orders[idx] };
    },

    adminDeleteOrder(id) {
      const session = this.getSession();
      if (!this.isManager()) return { error: 'manager only' };
      const order = this.getOrderById(id);
      if (!order) return { error: 'not found' };

      cache.orders = cache.orders.filter(o => o.id !== id);

      sb.from('orders').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Delete order error:', error); });

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

      const idx = cache.orders.findIndex(o => o.id === id);
      const now = new Date().toISOString();
      cache.orders[idx] = { ...cache.orders[idx], status: 'CANCELLED', cancelledAt: now, updatedAt: now };

      sb.from('orders').update({ status: 'CANCELLED', cancelled_at: now, updated_at: now }).eq('id', id)
        .then(({ error }) => { if (error) console.error('Cancel order error:', error); });

      this.addAuditLog({
        action: 'ORDER_CANCELLED',
        actor: session.username,
        actorId: session.id,
        orderId: id,
        orderNumber: order.orderNumber,
        result: 'success'
      });

      return { success: true, order: cache.orders[idx] };
    },

    // ── Audit Log ──
    addAuditLog(record) {
      const logId = uuid();
      const now = new Date().toISOString();
      const entry = { id: logId, createdAt: now, ...record };
      cache.audit.unshift(entry);

      sb.from('audit_logs').insert({
        id: logId,
        action: record.action,
        actor: record.actor,
        actor_id: record.actorId,
        order_id: record.orderId,
        order_number: record.orderNumber,
        result: record.result || 'success',
        created_at: now
      }).then(({ error }) => { if (error) console.error('Add audit log error:', error); });

      return entry;
    },

    getAuditLogs() { return cache.audit.slice(); },

    // ── Users & Auth ──
    getUsers() { return cache.users.slice(); },

    saveUsers(users) {
      cache.users = users.slice();
      return true;
    },

    getSession() { return localGet(LOCAL_KEYS.SESSION); },

    isManager() {
      const s = this.getSession();
      return !!s && s.role === 'manager';
    },

    isStaff() {
      const s = this.getSession();
      return !!s && (s.role === 'staff' || s.role === 'manager');
    },

    async addUser(username, password, role, displayName) {
      if (!this.isStaff()) return null;
      if (role === 'manager' && !this.isManager()) return null;
      if (cache.users.some(u => u.username === username)) return null;

      role = role || 'staff';
      displayName = (displayName || '').trim();
      const userId = uuid();
      const now = new Date().toISOString();

      // Create auth user in Supabase
      const email = username + AUTH_EMAIL_DOMAIN;
      const { data: authData, error: authError } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: { username, role, displayName }
        }
      });

      if (authError) {
        console.error('Add user auth error:', authError);
        // Fall back to metadata-only user
      }

      const authId = authData?.user?.id || userId;
      const user = {
        id: authId,
        username,
        role,
        displayName,
        disabled: false,
        createdAt: now
      };
      cache.users.push(user);

      sb.from('users').insert({
        id: authId,
        username,
        role,
        display_name: displayName,
        disabled: false,
        created_at: now
      }).then(({ error }) => { if (error) console.error('Add user metadata error:', error); });

      return user;
    },

    async updateUser(id, updates) {
      const idx = cache.users.findIndex(u => u.id === id);
      if (idx === -1) return null;
      const target = cache.users[idx];

      if (target.username === 'manager_admin' && !this.isManager()) return null;
      if (target.username === 'manager_admin' && updates.username && updates.username !== 'manager_admin') return null;
      if (updates.role === 'manager' && !this.isManager()) return null;
      if (target.username === 'manager_admin' && updates.role && updates.role !== 'manager') return null;

      const now = new Date().toISOString();
      cache.users[idx] = { ...cache.users[idx], ...updates, updatedAt: now };
      // Remove password from cache object (it's handled by Supabase Auth)
      delete cache.users[idx].password;

      const row = { updated_at: now };
      if (updates.username !== undefined) row.username = updates.username;
      if (updates.role !== undefined) row.role = updates.role;
      if (updates.displayName !== undefined) row.display_name = updates.displayName;
      if (updates.disabled !== undefined) row.disabled = updates.disabled;

      sb.from('users').update(row).eq('id', id)
        .then(({ error }) => { if (error) console.error('Update user error:', error); });

      return cache.users[idx];
    },

    deleteUser(id) {
      const target = cache.users.find(u => u.id === id);
      if (!target) return false;
      if (target.username === 'manager_admin') return false;
      if (target.role === 'manager' && !this.isManager()) return false;
      if (cache.users.filter(u => !u.disabled).length <= 1) return false;

      cache.users = cache.users.filter(u => u.id !== id);

      sb.from('users').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Delete user metadata error:', error); });

      return true;
    },

    toggleUserDisabled(id) {
      const idx = cache.users.findIndex(u => u.id === id);
      if (idx === -1) return null;
      const target = cache.users[idx];
      if (target.username === 'manager_admin') return null;
      if (target.role === 'manager' && !this.isManager()) return null;

      cache.users[idx].disabled = !cache.users[idx].disabled;
      cache.users[idx].updatedAt = new Date().toISOString();

      sb.from('users').update({
        disabled: cache.users[idx].disabled,
        updated_at: cache.users[idx].updatedAt
      }).eq('id', id)
        .then(({ error }) => { if (error) console.error('Toggle user disabled error:', error); });

      return cache.users[idx];
    },

    async login(username, password) {
      const email = username + AUTH_EMAIL_DOMAIN;

      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error || !data.user) {
        console.error('Login error:', error?.message || 'Unknown error');
        // Fallback: try matching against users table with hashed password
        const hash = await hashPassword(password);
        const userMeta = cache.users.find(u => u.username === username && !u.disabled);
        if (userMeta) {
          // Check if there's a legacy password match via the seed data
          const seedUsers = window.AVERROES_DATA ? window.AVERROES_DATA.users : [];
          const seedUser = seedUsers.find(u => u.username === username && u.password === hash);
          if (seedUser) {
            localSet(LOCAL_KEYS.SESSION, {
              id: userMeta.id,
              username: userMeta.username,
              role: userMeta.role,
              loggedInAt: new Date().toISOString()
            });
            return true;
          }
        }
        return false;
      }

      // Find user metadata
      const userMeta = cache.users.find(u => u.username === username);
      if (userMeta && userMeta.disabled) {
        await sb.auth.signOut();
        return false;
      }

      const role = userMeta ? userMeta.role : (data.user.user_metadata?.role || 'staff');
      localSet(LOCAL_KEYS.SESSION, {
        id: userMeta ? userMeta.id : data.user.id,
        username,
        role,
        loggedInAt: new Date().toISOString()
      });

      return true;
    },

    logout() {
      localStorage.removeItem(LOCAL_KEYS.SESSION);
      sb.auth.signOut().catch(() => {});
    },

    isLoggedIn() { return !!localGet(LOCAL_KEYS.SESSION); },

    // ── Export / Import ──
    exportAll() {
      const settings = { ...this.getSettings() };
      return {
        settings,
        categories: this.getCategories(),
        meals: this.getMeals(),
        orders: this.getOrders(),
        chats: this.getChats(),
        users: this.getUsers(),
        cart: this.getCart(),
        audit: this.getAuditLogs()
      };
    },

    importAll(data) {
      // Import into Supabase by seeding tables
      if (data.settings) this.saveSettings(data.settings);
      if (data.categories) {
        cache.categories = data.categories;
        data.categories.forEach(c => {
          sb.from('categories').upsert({
            id: c.id, title: c.title, subtitle: c.subtitle || '', order: c.order || 0
          }).then(() => {});
        });
      }
      if (data.meals) {
        cache.meals = data.meals;
        data.meals.forEach(m => {
          sb.from('meals').upsert({
            id: m.id, name: m.name, category_id: m.categoryId, price: m.price,
            image: m.image || '', available: m.available !== false,
            out_of_stock: m.outOfStock === true, hidden: m.hidden === true
          }).then(() => {});
        });
      }
      if (data.orders) cache.orders = data.orders;
      if (data.chats) cache.chats = data.chats;
      if (data.users) cache.users = data.users;
      if (data.cart) localSet(LOCAL_KEYS.CART, data.cart);
      if (data.audit) cache.audit = data.audit;
    },

    // ── Expenses ──
    getExpenses() { return cache.expenses.slice(); },

    saveExpenses(expenses) {
      cache.expenses = expenses.slice();
      return true;
    },

    addExpense(expense) {
      const expId = uuid();
      const now = new Date().toISOString();
      const newExpense = {
        id: expId,
        description: expense.description || '',
        category: expense.category || 'General',
        amount: parseFloat(expense.amount) || 0,
        paymentMethod: expense.paymentMethod || 'Cash',
        notes: expense.notes || '',
        createdBy: expense.createdBy || 'admin',
        createdAt: now
      };
      cache.expenses.unshift(newExpense);

      sb.from('expenses').insert({
        id: expId,
        description: newExpense.description,
        category: newExpense.category,
        amount: newExpense.amount,
        payment_method: newExpense.paymentMethod,
        notes: newExpense.notes,
        created_by: newExpense.createdBy,
        created_at: now
      }).then(({ error }) => { if (error) console.error('Add expense error:', error); });

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
      const idx = cache.expenses.findIndex(e => e.id === id);
      if (idx === -1) return null;
      const now = new Date().toISOString();
      cache.expenses[idx] = { ...cache.expenses[idx], ...updates, updatedAt: now };

      const row = { updated_at: now };
      if (updates.description !== undefined) row.description = updates.description;
      if (updates.category !== undefined) row.category = updates.category;
      if (updates.amount !== undefined) row.amount = updates.amount;
      if (updates.paymentMethod !== undefined) row.payment_method = updates.paymentMethod;
      if (updates.notes !== undefined) row.notes = updates.notes;

      sb.from('expenses').update(row).eq('id', id)
        .then(({ error }) => { if (error) console.error('Update expense error:', error); });

      return cache.expenses[idx];
    },

    deleteExpense(id) {
      cache.expenses = cache.expenses.filter(e => e.id !== id);
      sb.from('expenses').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Delete expense error:', error); });
    },

    // ── Transactions ──
    getTransactions() { return cache.transactions.slice(); },

    saveTransactions(transactions) {
      cache.transactions = transactions.slice();
      return true;
    },

    addTransaction(transaction) {
      const txId = uuid();
      const now = new Date().toISOString();
      const newTx = {
        id: txId,
        type: transaction.type || 'OTHER',
        description: transaction.description || '',
        amount: parseFloat(transaction.amount) || 0,
        relatedId: transaction.relatedId || null,
        category: transaction.category || '',
        paymentMethod: transaction.paymentMethod || '',
        status: transaction.status || 'COMPLETED',
        createdAt: now
      };
      cache.transactions.unshift(newTx);

      sb.from('transactions').insert({
        id: txId,
        type: newTx.type,
        description: newTx.description,
        amount: newTx.amount,
        related_id: newTx.relatedId,
        category: newTx.category,
        payment_method: newTx.paymentMethod,
        status: newTx.status,
        created_at: now
      }).then(({ error }) => { if (error) console.error('Add transaction error:', error); });

      return newTx;
    },

    // ── Reset ──
    async resetToSeed() {
      // Clear all Supabase tables
      await sb.from('audit_logs').delete().neq('id', '');
      await sb.from('transactions').delete().neq('id', '');
      await sb.from('expenses').delete().neq('id', '');
      await sb.from('messages').delete().neq('id', '');
      await sb.from('chats').delete().neq('id', '');
      await sb.from('orders').delete().neq('id', '');
      await sb.from('meals').delete().neq('id', '');
      await sb.from('categories').delete().neq('id', '');

      // Re-seed from AVERROES_DATA
      if (window.AVERROES_DATA) {
        const cats = window.AVERROES_DATA.categories || [];
        for (const c of cats) {
          await sb.from('categories').insert({
            id: c.id, title: c.title, subtitle: c.subtitle || '', order: c.order || 0
          });
        }
        const meals = window.AVERROES_DATA.meals || [];
        for (const m of meals) {
          await sb.from('meals').insert({
            id: m.id, name: m.name, category_id: m.categoryId, price: m.price,
            image: m.image || '', available: m.available !== false,
            out_of_stock: m.outOfStock === true, hidden: m.hidden === true
          });
        }
        await sb.from('settings').upsert({
          id: 'main',
          restaurant_name: window.AVERROES_DATA.settings.restaurantName,
          tagline: window.AVERROES_DATA.settings.tagline,
          address: window.AVERROES_DATA.settings.address || '',
          currency: window.AVERROES_DATA.settings.currency || '₦',
          locale: window.AVERROES_DATA.settings.locale || 'en-NG',
          logo_url: window.AVERROES_DATA.settings.logoUrl || ''
        });
      }

      // Re-fetch everything
      await Promise.all([
        fetchCategories(), fetchMeals(), fetchOrders(),
        fetchChatsWithMessages(), fetchSettings(), fetchUsers(),
        fetchExpenses(), fetchTransactions(), fetchAuditLogs()
      ]);

      localSet(LOCAL_KEYS.CART, {});
    }
  };

  DB.slugify = slugify;
  DB.uuid = uuid;
  window.AverroesDB = DB;

  // Auto-init: fetch all data from Supabase on load
  init();
})(window);
