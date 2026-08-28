/* =========================================================
   auth.js
   Owner login (owner-login.html) + shared "is this user the
   owner" guard used by owner-dashboard.html.

   Security note: this file only controls what the *browser*
   shows. The real enforcement is server-side, via Postgres
   Row Level Security policies in /supabase/rls-policies.sql
   and Storage policies in /supabase/storage-policies.sql —
   so even a user who bypasses this JS cannot read/write
   owner-only data.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.querySelector("[data-login-form]");
  if (loginForm) initLoginForm(loginForm);
});

function initLoginForm(form) {
  const alertBox = document.querySelector("[data-login-alert]");
  const submitBtn = form.querySelector('button[type="submit"]');

  // If already logged in as owner, skip straight to the dashboard.
  supabaseClient.auth.getSession().then(async ({ data }) => {
    if (data.session) {
      const isOwner = await verifyOwnerRole(data.session.user.id);
      if (isOwner) window.location.href = "owner-dashboard.html";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert(alertBox);

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      showAlert(alertBox, "Please enter both email and password.", "error");
      return;
    }

    setLoading(submitBtn, true, "Signing in…");

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(submitBtn, false, "Log In");
      showAlert(alertBox, mapAuthError(error), "error");
      return;
    }

    const isOwner = await verifyOwnerRole(data.user.id);

    if (!isOwner) {
      // Wrong account type — do NOT grant dashboard access.
      await supabaseClient.auth.signOut();
      setLoading(submitBtn, false, "Log In");
      showAlert(alertBox, "This account is not authorized to access the Owner Dashboard.", "error");
      return;
    }

    showAlert(alertBox, "Login successful. Redirecting…", "success");
    window.location.href = "owner-dashboard.html";
  });
}

/** Reads the profiles table (RLS-protected) to confirm role = 'owner'. */
async function verifyOwnerRole(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return data.role === "owner";
}

function mapAuthError(error) {
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("email not confirmed")) return "Please confirm your email before logging in.";
  if (msg.includes("network")) return "Network error. Please check your connection and try again.";
  return "Unable to log in right now. Please try again.";
}

function showAlert(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = "form-alert " + type;
}
function hideAlert(el) {
  if (!el) return;
  el.className = "form-alert";
  el.textContent = "";
}
function setLoading(btn, isLoading, label) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.innerHTML = isLoading ? `<span class="loader"></span> ${label}` : label;
}

/**
 * Guard for owner-dashboard.html. Call at the top of dashboard.js.
 * Redirects to owner-login.html if not authenticated or not the owner.
 * Returns the authenticated user object on success.
 */
async function requireOwnerSession() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const session = sessionData.session;

  if (!session) {
    window.location.href = "owner-login.html";
    return null;
  }

  const isOwner = await verifyOwnerRole(session.user.id);
  if (!isOwner) {
    await supabaseClient.auth.signOut();
    window.location.href = "owner-login.html";
    return null;
  }

  return session.user;
}
