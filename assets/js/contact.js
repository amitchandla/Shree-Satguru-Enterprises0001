/* =========================================================
   contact.js
   Customer inquiry form: client-side validation for UX,
   then inserts into the `inquiries` table. RLS allows public
   INSERT only (no read/update/delete) — see rls-policies.sql.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("[data-inquiry-form]");
  if (form) initInquiryForm(form);
});

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

function initInquiryForm(form) {
  const alertBox = document.querySelector("[data-inquiry-alert]");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormAlert(alertBox);

    const name = form.name.value.trim();
    const phoneRaw = form.phone.value.trim();
    const phone = phoneRaw.replace(/\D/g, "").slice(-10);
    const message = form.message.value.trim();

    const errors = validateInquiry(name, phone);
    renderFieldErrors(form, errors);

    if (Object.keys(errors).length > 0) return;

    setSubmitLoading(submitBtn, true);

    const { error } = await supabaseClient.from("inquiries").insert({
      name,
      phone,
      message: message || null,
    });

    setSubmitLoading(submitBtn, false);

    if (error) {
      console.error("Inquiry submit error:", error.message);
      showFormAlert(alertBox, "Something went wrong while submitting your inquiry. Please try again or call us directly.", "error");
      return;
    }

    form.reset();
    showFormAlert(alertBox, "Thank you! Your inquiry has been submitted successfully.", "success");
  });

  // Clear an individual field's error as the user fixes it.
  ["name", "phone"].forEach((fieldName) => {
    form[fieldName].addEventListener("input", () => {
      form[fieldName].closest(".field").classList.remove("has-error");
    });
  });
}

function validateInquiry(name, phone) {
  const errors = {};
  if (!name) errors.name = "Please enter your name.";
  if (!phone || !INDIAN_MOBILE_REGEX.test(phone)) {
    errors.phone = "Please enter a valid 10-digit Indian mobile number.";
  }
  return errors;
}

function renderFieldErrors(form, errors) {
  ["name", "phone"].forEach((fieldName) => {
    const fieldWrap = form[fieldName].closest(".field");
    const errorEl = fieldWrap.querySelector(".field-error");
    if (errors[fieldName]) {
      fieldWrap.classList.add("has-error");
      if (errorEl) errorEl.textContent = errors[fieldName];
    } else {
      fieldWrap.classList.remove("has-error");
    }
  });
}

function showFormAlert(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = "form-alert " + type;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}
function hideFormAlert(el) {
  if (!el) return;
  el.className = "form-alert";
  el.textContent = "";
}
function setSubmitLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.innerHTML = isLoading ? `<span class="loader"></span> Submitting…` : "Submit Inquiry";
}
