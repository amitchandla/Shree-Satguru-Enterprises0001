/* =========================================================
   main.js
   Shared behavior for every public page:
   - mobile nav toggle
   - loads business_settings from Supabase and wires up
     Call / WhatsApp / Directions / footer / contact info
   - floating Call + WhatsApp buttons
   ========================================================= */

const DEFAULT_WHATSAPP_MESSAGE = "Hello Shree Satguru Enterprises, I am interested in your products.";

document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  markActiveNavLink();
  loadAndApplyBusinessSettings();
  initProductSearch();
});

function initMobileNav() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav-menu]");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function markActiveNavLink() {
  const current = (location.pathname.split("/").pop() || "index.html");
  document.querySelectorAll("[data-nav-menu] a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === current || (current === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });
}

async function loadAndApplyBusinessSettings() {
  const settings = await fetchBusinessSettings();

  // Sensible fallbacks in case the table is empty or the request fails,
  // so the page never shows broken links.
  const info = {
    business_name: settings?.business_name || "Shree Satguru Enterprises",
    owner_name: settings?.owner_name || "Mr. Hansraj",
    description: settings?.description ||
      "Shree Satguru Enterprises is a trusted destination for a wide range of hardware, paint, and electrical products. We focus on providing quality products at competitive wholesale prices.",
    phone_primary: settings?.phone_primary || "9416888344",
    phone_secondary: settings?.phone_secondary || "9729185344",
    whatsapp_number: settings?.whatsapp_number || "9416888344",
    address: settings?.address || "Near HP Petrol Pump, Main Bus Stand, Mohanpur, Rewari, Haryana – 123401, India",
    location_url: settings?.location_url || "",
  };

  document.querySelectorAll("[data-call-link]").forEach((el) => {
    el.setAttribute("href", buildTelLink(info.phone_primary));
  });
  document.querySelectorAll("[data-whatsapp-link]").forEach((el) => {
    el.setAttribute("href", buildWhatsAppLink(info.whatsapp_number, DEFAULT_WHATSAPP_MESSAGE));
  });
  document.querySelectorAll("[data-directions-link]").forEach((el) => {
    if (info.location_url) {
      el.setAttribute("href", info.location_url);
      el.classList.remove("is-disabled");
      el.removeAttribute("aria-disabled");
    } else {
      // Owner hasn't set a location link yet — don't send visitors to a
      // wrong/hardcoded address. Disable the button instead.
      el.setAttribute("href", "#");
      el.setAttribute("aria-disabled", "true");
      el.classList.add("is-disabled");
      el.addEventListener("click", (e) => {
        e.preventDefault();
        alert("Directions link is not set up yet. Please call us for directions: " + info.phone_primary);
      });
    }
  });

  document.querySelectorAll("[data-business-name]").forEach((el) => (el.textContent = info.business_name));
  document.querySelectorAll("[data-owner-name]").forEach((el) => (el.textContent = info.owner_name));
  document.querySelectorAll("[data-description]").forEach((el) => (el.textContent = info.description));
  document.querySelectorAll("[data-phone-primary]").forEach((el) => (el.textContent = info.phone_primary));
  document.querySelectorAll("[data-phone-secondary]").forEach((el) => (el.textContent = info.phone_secondary));
  document.querySelectorAll("[data-whatsapp-number]").forEach((el) => (el.textContent = info.whatsapp_number));
  document.querySelectorAll("[data-address]").forEach((el) => (el.textContent = info.address));
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
}

/* ---------------------------------------------------------
   Product search (products.html)
   Filters the static category lists rendered in the DOM —
   fast, no network round-trip needed for a fixed catalog.
   --------------------------------------------------------- */
function initProductSearch() {
  const input = document.querySelector("[data-product-search]");
  if (!input) return;

  const cards = Array.from(document.querySelectorAll("[data-category-card]"));
  const items = Array.from(document.querySelectorAll("[data-product-item]"));
  const emptyState = document.querySelector("[data-search-empty]");

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();

    // Reset
    items.forEach((li) => {
      li.style.display = "";
      li.classList.remove("hit");
    });
    cards.forEach((card) => (card.style.display = ""));

    if (!query) {
      if (emptyState) emptyState.style.display = "none";
      return;
    }

    let anyVisible = false;

    cards.forEach((card) => {
      const cardItems = Array.from(card.querySelectorAll("[data-product-item]"));
      let cardHasMatch = false;

      cardItems.forEach((li) => {
        const text = li.textContent.trim().toLowerCase();
        const matches = text.includes(query);
        li.style.display = matches ? "" : "none";
        if (matches) {
          li.classList.add("hit");
          cardHasMatch = true;
          anyVisible = true;
        }
      });

      card.style.display = cardHasMatch ? "" : "none";
    });

    if (emptyState) emptyState.style.display = anyVisible ? "none" : "block";
  });
}
