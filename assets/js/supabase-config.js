/**
 * Averroes Restaurant - Supabase Configuration
 * Initializes the Supabase client for database and auth operations.
 */
(function (window) {
  'use strict';

  // Read from Vercel injected config
  const config = window.SITE_CONFIG || {};
  const SUPABASE_URL = config.supabaseUrl;
  const SUPABASE_ANON_KEY = config.supabaseAnonKey;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('CRITICAL: Supabase URL and Anon Key are missing from SITE_CONFIG. Did you set the Vercel Environment Variables?');
    alert('Database configuration is missing. Please contact the administrator.');
  }

  const _supabase = window.supabase.createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_ANON_KEY || 'placeholder');

  window.AverroesSupabase = _supabase;
  window.SUPABASE_URL = SUPABASE_URL;
})(window);
