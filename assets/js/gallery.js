/* =========================================================
   gallery.js
   Public gallery page: loads gallery_media (read-only, RLS
   allows anyone to SELECT), renders image/video tiles,
   supports type filtering and a lightbox viewer.
   Visitors can only view — no upload/edit/delete controls
   exist on this page at all.
   ========================================================= */

let allMedia = [];
let activeFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.querySelector("[data-gallery-grid]");
  if (!grid) return;
  initGalleryFilters();
  initLightbox();
  loadGallery();
});

async function loadGallery() {
  const grid = document.querySelector("[data-gallery-grid]");
  const emptyState = document.querySelector("[data-gallery-empty]");
  grid.innerHTML = `<div class="page-loading">Loading gallery…</div>`;

  const { data, error } = await supabaseClient
    .from("gallery_media")
    .select("id, title, description, media_type, file_url, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    grid.innerHTML = "";
    if (emptyState) {
      emptyState.style.display = "block";
      emptyState.textContent = "We couldn't load the gallery right now. Please try again shortly.";
    }
    console.error("Gallery load error:", error.message);
    return;
  }

  allMedia = data || [];
  renderGallery();
}

function renderGallery() {
  const grid = document.querySelector("[data-gallery-grid]");
  const emptyState = document.querySelector("[data-gallery-empty]");
  grid.innerHTML = "";

  const filtered = activeFilter === "all" ? allMedia : allMedia.filter((m) => m.media_type === activeFilter);

  if (filtered.length === 0) {
    if (emptyState) {
      emptyState.style.display = "block";
      emptyState.textContent = "No media has been added yet. Please check back soon.";
    }
    return;
  }
  if (emptyState) emptyState.style.display = "none";

  filtered.forEach((item) => {
    const tile = document.createElement("div");
    tile.className = "gallery-item";
    tile.setAttribute("role", "button");
    tile.setAttribute("tabindex", "0");
    tile.setAttribute("aria-label", `View ${item.media_type}: ${item.title || "media item"}`);

    const badge = item.media_type === "video" ? "Video" : "Photo";
    const preview =
      item.media_type === "video"
        ? `<video src="${escapeHtml(item.file_url)}#t=0.5" muted preload="metadata"></video>`
        : `<img src="${escapeHtml(item.file_url)}" alt="${escapeHtml(item.title || "Gallery image")}" loading="lazy" />`;

    tile.innerHTML = `
      ${preview}
      <span class="badge">${badge}</span>
      ${item.title ? `<span class="cap">${escapeHtml(item.title)}</span>` : ""}
    `;

    const open = () => openLightbox(item);
    tile.addEventListener("click", open);
    tile.addEventListener("keypress", (e) => {
      if (e.key === "Enter" || e.key === " ") open();
    });

    grid.appendChild(tile);
  });
}

function initGalleryFilters() {
  document.querySelectorAll("[data-gallery-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-gallery-filter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.getAttribute("data-gallery-filter");
      renderGallery();
    });
  });
}

function initLightbox() {
  const lightbox = document.querySelector("[data-lightbox]");
  if (!lightbox) return;
  lightbox.querySelector("[data-lightbox-close]").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });
}

function openLightbox(item) {
  const lightbox = document.querySelector("[data-lightbox]");
  const content = lightbox.querySelector("[data-lightbox-media]");
  const caption = lightbox.querySelector("[data-lightbox-caption]");

  content.innerHTML =
    item.media_type === "video"
      ? `<video src="${escapeHtml(item.file_url)}" controls autoplay></video>`
      : `<img src="${escapeHtml(item.file_url)}" alt="${escapeHtml(item.title || "Gallery image")}" />`;

  caption.textContent = [item.title, item.description].filter(Boolean).join(" — ");
  lightbox.classList.add("open");
}

function closeLightbox() {
  const lightbox = document.querySelector("[data-lightbox]");
  if (!lightbox) return;
  lightbox.classList.remove("open");
  lightbox.querySelector("[data-lightbox-media]").innerHTML = "";
}
