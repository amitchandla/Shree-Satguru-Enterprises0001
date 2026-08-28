/* =========================================================
   dashboard.js
   Owner Dashboard logic: auth guard, sidebar navigation,
   overview counts, gallery management (upload/edit/delete),
   business details, location, customer inquiries, account.

   Every write here is also enforced server-side by RLS
   (rls-policies.sql) and Storage policies
   (storage-policies.sql) — this file assumes the browser
   cannot be trusted, and the database does not either.
   ========================================================= */

let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = await requireOwnerSession();
  if (!currentUser) return; // requireOwnerSession already redirected

  initSidebar();
  initLogout();
  await Promise.all([
    loadOverviewCounts(),
    loadBusinessDetailsForm(),
    loadLocationForm(),
    loadGalleryManager(),
    loadInquiries(),
  ]);
  renderAccountPanel();
});

/* ---------------------------------------------------------
   Sidebar / panel switching
   --------------------------------------------------------- */
function initSidebar() {
  const buttons = document.querySelectorAll("[data-panel-target]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".dash-panel").forEach((p) => p.classList.remove("active"));
      document.querySelector(`[data-panel="${btn.dataset.panelTarget}"]`).classList.add("active");
      document.querySelector(".dash-sidebar")?.classList.remove("open");
    });
  });

  const mobileToggle = document.querySelector("[data-dash-mobile-toggle]");
  mobileToggle?.addEventListener("click", () => {
    document.querySelector(".dash-sidebar").classList.toggle("open");
  });
}

function initLogout() {
  document.querySelectorAll("[data-logout]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "owner-login.html";
    });
  });
}

function renderAccountPanel() {
  const emailEl = document.querySelector("[data-account-email]");
  if (emailEl) emailEl.textContent = currentUser.email;
  const chip = document.querySelector("[data-dash-user-chip]");
  if (chip) chip.textContent = currentUser.email;
}

/* ---------------------------------------------------------
   Overview counts
   --------------------------------------------------------- */
async function loadOverviewCounts() {
  const [{ count: photoCount }, { count: videoCount }, { count: inquiryCount }] = await Promise.all([
    supabaseClient.from("gallery_media").select("id", { count: "exact", head: true }).eq("media_type", "image"),
    supabaseClient.from("gallery_media").select("id", { count: "exact", head: true }).eq("media_type", "video"),
    supabaseClient.from("inquiries").select("id", { count: "exact", head: true }),
  ]);

  setText("[data-count-photos]", photoCount ?? 0);
  setText("[data-count-videos]", videoCount ?? 0);
  setText("[data-count-inquiries]", inquiryCount ?? 0);
}

/* ---------------------------------------------------------
   Business Details
   --------------------------------------------------------- */
async function loadBusinessDetailsForm() {
  const form = document.querySelector("[data-business-form]");
  if (!form) return;

  const { data } = await supabaseClient.from("business_settings").select("*").limit(1).maybeSingle();
  if (data) {
    form.business_name.value = data.business_name || "";
    form.owner_name.value = data.owner_name || "";
    form.description.value = data.description || "";
    form.phone_primary.value = data.phone_primary || "";
    form.phone_secondary.value = data.phone_secondary || "";
    form.whatsapp_number.value = data.whatsapp_number || "";
    form.address.value = data.address || "";
    form.dataset.rowId = data.id;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertBox = document.querySelector("[data-business-alert]");
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<span class="loader"></span> Saving…`;

    const payload = {
      business_name: form.business_name.value.trim(),
      owner_name: form.owner_name.value.trim(),
      description: form.description.value.trim(),
      phone_primary: form.phone_primary.value.trim(),
      phone_secondary: form.phone_secondary.value.trim(),
      whatsapp_number: form.whatsapp_number.value.trim(),
      address: form.address.value.trim(),
      updated_at: new Date().toISOString(),
    };

    const query = form.dataset.rowId
      ? supabaseClient.from("business_settings").update(payload).eq("id", form.dataset.rowId)
      : supabaseClient.from("business_settings").insert(payload);

    const { error } = await query;

    btn.disabled = false;
    btn.textContent = "Save Business Details";

    if (error) {
      showPanelAlert(alertBox, "Could not save changes: " + error.message, "error");
    } else {
      showPanelAlert(alertBox, "Business details updated. Changes are now live on the website.", "success");
    }
  });
}

/* ---------------------------------------------------------
   Location Management
   --------------------------------------------------------- */
async function loadLocationForm() {
  const form = document.querySelector("[data-location-form]");
  if (!form) return;

  const { data } = await supabaseClient.from("business_settings").select("id, location_url").limit(1).maybeSingle();
  if (data) {
    form.location_url.value = data.location_url || "";
    form.dataset.rowId = data.id;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertBox = document.querySelector("[data-location-alert]");
    const url = form.location_url.value.trim();

    if (url && !/^https?:\/\//i.test(url)) {
      showPanelAlert(alertBox, "Please enter a valid Google Maps link starting with https://", "error");
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<span class="loader"></span> Saving…`;

    const query = form.dataset.rowId
      ? supabaseClient.from("business_settings").update({ location_url: url, updated_at: new Date().toISOString() }).eq("id", form.dataset.rowId)
      : supabaseClient.from("business_settings").insert({ location_url: url });

    const { error } = await query;

    btn.disabled = false;
    btn.textContent = "Save Location Link";

    if (error) {
      showPanelAlert(alertBox, "Could not save the location link: " + error.message, "error");
    } else {
      showPanelAlert(alertBox, "Location link updated. The Get Directions button now uses this link.", "success");
    }
  });
}

/* ---------------------------------------------------------
   Gallery Management
   --------------------------------------------------------- */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_FILE_SIZE_MB = 50;

async function loadGalleryManager() {
  const uploadForm = document.querySelector("[data-media-upload-form]");
  const tableBody = document.querySelector("[data-media-table-body]");
  if (!uploadForm || !tableBody) return;

  uploadForm.addEventListener("submit", handleMediaUpload);
  await refreshMediaTable();
}

async function handleMediaUpload(e) {
  e.preventDefault();
  const form = e.target;
  const alertBox = document.querySelector("[data-media-alert]");
  const fileInput = form.media_file;
  const file = fileInput.files[0];
  const progressBar = document.querySelector("[data-upload-progress]");
  const progressFill = progressBar.querySelector("div");

  if (!file) {
    showPanelAlert(alertBox, "Please choose a photo or video to upload.", "error");
    return;
  }

  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    showPanelAlert(alertBox, "Unsupported file type. Please use JPG, PNG, WEBP images or MP4, WEBM videos.", "error");
    return;
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    showPanelAlert(alertBox, `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`, "error");
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="loader"></span> Uploading…`;
  progressBar.classList.add("active");
  progressFill.style.width = "20%";

  const mediaType = isImage ? "image" : "video";
  const fileExt = file.name.split(".").pop();
  const filePath = `${mediaType}s/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

  const { error: uploadError } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  progressFill.style.width = "70%";

  if (uploadError) {
    resetUploadUi(submitBtn, progressBar, progressFill);
    showPanelAlert(alertBox, "Upload failed: " + uploadError.message, "error");
    return;
  }

  const { data: publicUrlData } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

  const { error: insertError } = await supabaseClient.from("gallery_media").insert({
    title: form.title.value.trim() || null,
    description: form.description.value.trim() || null,
    media_type: mediaType,
    file_url: publicUrlData.publicUrl,
    file_path: filePath,
    created_by: currentUser.id,
  });

  progressFill.style.width = "100%";

  if (insertError) {
    // Roll back the uploaded file if we couldn't save the record.
    await supabaseClient.storage.from(STORAGE_BUCKET).remove([filePath]);
    resetUploadUi(submitBtn, progressBar, progressFill);
    showPanelAlert(alertBox, "Could not save media details: " + insertError.message, "error");
    return;
  }

  resetUploadUi(submitBtn, progressBar, progressFill);
  form.reset();
  showPanelAlert(alertBox, "Media uploaded successfully.", "success");
  await refreshMediaTable();
  await loadOverviewCounts();
}

function resetUploadUi(submitBtn, progressBar, progressFill) {
  submitBtn.disabled = false;
  submitBtn.textContent = "Upload Media";
  setTimeout(() => {
    progressBar.classList.remove("active");
    progressFill.style.width = "0%";
  }, 500);
}

async function refreshMediaTable() {
  const tableBody = document.querySelector("[data-media-table-body]");
  const { data, error } = await supabaseClient
    .from("gallery_media")
    .select("id, title, description, media_type, file_url, file_path, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="4">Could not load media: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="4">No media uploaded yet. Use the form above to add your first photo or video.</td></tr>`;
    return;
  }

  tableBody.innerHTML = data
    .map((item) => {
      const preview =
        item.media_type === "video"
          ? `<video class="thumb" src="${escapeHtml(item.file_url)}" muted></video>`
          : `<img class="thumb" src="${escapeHtml(item.file_url)}" alt="" />`;
      return `
        <tr data-media-row="${item.id}">
          <td>${preview}</td>
          <td>
            <strong>${escapeHtml(item.title || "(untitled)")}</strong><br/>
            <span style="color:var(--color-body);font-size:.85rem;">${escapeHtml(item.description || "")}</span>
          </td>
          <td>${item.media_type === "video" ? "Video" : "Image"}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-outline-navy btn-sm" data-edit-media="${item.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-delete-media="${item.id}" data-file-path="${escapeHtml(item.file_path)}">Delete</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  tableBody.querySelectorAll("[data-edit-media]").forEach((btn) => {
    btn.addEventListener("click", () => openEditMedia(btn.dataset.editMedia, data));
  });
  tableBody.querySelectorAll("[data-delete-media]").forEach((btn) => {
    btn.addEventListener("click", () => deleteMedia(btn.dataset.deleteMedia, btn.dataset.filePath));
  });
}

function openEditMedia(id, allItems) {
  const item = allItems.find((m) => String(m.id) === String(id));
  if (!item) return;
  const newTitle = prompt("Edit title:", item.title || "");
  if (newTitle === null) return;
  const newDescription = prompt("Edit description:", item.description || "");
  if (newDescription === null) return;

  supabaseClient
    .from("gallery_media")
    .update({ title: newTitle.trim() || null, description: newDescription.trim() || null })
    .eq("id", id)
    .then(({ error }) => {
      const alertBox = document.querySelector("[data-media-alert]");
      if (error) {
        showPanelAlert(alertBox, "Could not update media: " + error.message, "error");
      } else {
        showPanelAlert(alertBox, "Media details updated.", "success");
        refreshMediaTable();
      }
    });
}

async function deleteMedia(id, filePath) {
  const confirmed = confirm("Are you sure you want to delete this item?");
  if (!confirmed) return;

  const alertBox = document.querySelector("[data-media-alert]");

  const { error: dbError } = await supabaseClient.from("gallery_media").delete().eq("id", id);
  if (dbError) {
    showPanelAlert(alertBox, "Could not delete media: " + dbError.message, "error");
    return;
  }

  if (filePath) {
    await supabaseClient.storage.from(STORAGE_BUCKET).remove([filePath]);
  }

  showPanelAlert(alertBox, "Media deleted.", "success");
  await refreshMediaTable();
  await loadOverviewCounts();
}

/* ---------------------------------------------------------
   Customer Inquiries
   --------------------------------------------------------- */
async function loadInquiries() {
  const tableBody = document.querySelector("[data-inquiries-table-body]");
  if (!tableBody) return;

  const { data, error } = await supabaseClient
    .from("inquiries")
    .select("id, name, phone, message, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="4">Could not load inquiries: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="4">No customer inquiries yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = data
    .map((row) => {
      const created = new Date(row.created_at);
      const date = created.toLocaleDateString("en-IN");
      const time = created.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      return `
        <tr>
          <td><strong>${escapeHtml(row.name)}</strong></td>
          <td><a href="tel:${escapeHtml(row.phone)}">${escapeHtml(row.phone)}</a></td>
          <td>${escapeHtml(row.message || "—")}</td>
          <td>${date}<br/><span style="color:var(--color-body);font-size:.82rem;">${time}</span></td>
        </tr>`;
    })
    .join("");
}

/* ---------------------------------------------------------
   Small helpers
   --------------------------------------------------------- */
function setText(selector, value) {
  document.querySelectorAll(selector).forEach((el) => (el.textContent = value));
}

function showPanelAlert(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = "form-alert " + type;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  if (type === "success") {
    setTimeout(() => {
      el.className = "form-alert";
      el.textContent = "";
    }, 4000);
  }
}
