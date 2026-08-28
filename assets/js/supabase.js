/* =========================================================
   supabase.js
   Initializes a single shared Supabase client for the site.

   IMPORTANT:
   - Only the public URL and the ANON key ever go here.
   - The anon key is safe to expose in frontend code as long
     as Row Level Security (see /supabase/rls-policies.sql)
     is enabled on every table. Never put the Service Role
     key in this file or anywhere in the browser.
   - Fill in your project's real values below, or (recommended
     for local dev) load them from a small untracked
     config file — see README.md Step 8.
   ========================================================= */

// TODO: replace with your Supabase project values (see .env.example)
const SUPABASE_URL = window.__SSE_CONFIG__?.SUPABASE_URL || "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = window.__SSE_CONFIG__?.SUPABASE_ANON_KEY || "YOUR-SUPABASE-ANON-KEY";

// Loaded from the CDN script tag included on every page (see <head>).
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

const STORAGE_BUCKET = "business-media";

/* ---------------------------------------------------------
   Small shared helpers used across pages
   --------------------------------------------------------- */

/** Fetch the single business_settings row (public read). */
async function fetchBusinessSettings() {
  const { data, error } = await supabaseClient
    .from("business_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Failed to load business settings:", error.message);
    return null;
  }
  return data;
}

/** Build a WhatsApp deep link with a pre-filled message. */
function buildWhatsAppLink(number, message) {
  const digits = String(number).replace(/\D/g, "");
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`;
}

/** Build a tel: link. */
function buildTelLink(number) {
  const digits = String(number).replace(/\D/g, "");
  return `tel:${digits}`;
}

/** Escape user-supplied text before inserting into innerHTML. */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
