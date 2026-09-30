/**
 * Averroes Restaurant - Supabase Configuration
 * Initializes the Supabase client for database and auth operations.
 */
(function (window) {
  'use strict';

  // Read from Vercel injected config, fallback to local development Averroes keys
  const config = window.SITE_CONFIG || {};
  const SUPABASE_URL = config.supabaseUrl || 'https://ydyfudslhczqegdnfrid.supabase.co';
  const SUPABASE_ANON_KEY = config.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkeWZ1ZHNsaGN6cWVnZG5mcmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MDk1MDUsImV4cCI6MjEwNTM4NTUwNX0.DX-l8f89_K9uxbbrXhjdd-KyCRZejcrD7szmvSvdb5Y';

  const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.AverroesSupabase = _supabase;
  window.SUPABASE_URL = SUPABASE_URL;
})(window);
