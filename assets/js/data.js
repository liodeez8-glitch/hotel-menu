/**
 * Averroes Restaurant - Default Application Data (Generic Fallback)
 * This file serves as an empty fallback for new hotels before their Supabase database is populated.
 * ALL real data is loaded from Supabase at runtime.
 */
(function(window) {
  'use strict';

  const NOW = new Date().toISOString();

  // Empty fallback categories
  const CATEGORIES = [];

  // Empty fallback meals
  const MEALS = [];

  // Generic fallback settings
  const SETTINGS = {
    restaurantName: 'Restaurant Menu',
    tagline: 'Welcome',
    address: 'Address not set',
    currency: '₦',
    locale: 'en-NG',
    logoUrl: ''
  };

  // Default admin user for fallback login (real users are in Supabase)
  const USERS = [
    { id: 'admin', username: 'admin', role: 'manager', password: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', disabled: false, createdAt: NOW } // password: admin
  ];

  window.AVERROES_DATA = {
    categories: CATEGORIES,
    meals: MEALS,
    settings: SETTINGS,
    users: USERS,
    orders: []
  };
})(window);
