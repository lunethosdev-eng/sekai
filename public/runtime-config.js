// Chromi runtime configuration. Safe for public builds.
// NEVER place a Supabase secret/service_role key here.
window.CHROMI_SUPABASE_URL = window.CHROMI_SUPABASE_URL || 'https://gnduhwtbnmthliiitiaj.supabase.co';
window.CHROMI_SUPABASE_PUBLISHABLE_KEY = window.CHROMI_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_nzPiPDjojBkK4N8NXs68Ow_2mqtlJ2G';

// Backend Sekai en Render
window.CHROMI_API_BASE = 'https://sekai-yxto.onrender.com';
window.CHROMI_API_BASE_URL = 'https://sekai-yxto.onrender.com';

// Redirect OAuth (web). En Android nativo se usa chromi://auth-callback
window.CHROMI_AUTH_REDIRECT = window.CHROMI_AUTH_REDIRECT || (typeof location !== 'undefined' ? location.origin : '');
