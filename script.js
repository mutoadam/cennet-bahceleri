const cfg = window.CENNET_CONFIG || {};
if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
  console.warn("Supabase config missing. Edit config.js first.");
}
const supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL || "", cfg.SUPABASE_ANON_KEY || "");
const form = document.getElementById("suggestionForm");
const msg = document.getElementById("formMessage");
const btn = document.getElementById("submitBtn");
const preview = document.getElementById("preview");
const photoInput = document.getElementById("photoInput");
const success = document.getElementById("success");
const newSuggestion = document.getElementById("newSuggestion");
const playLink = document.getElementById("playLink");
const confirmCheck = document.getElementById("confirmCheck");
const fileName = document.getElementById("fileName");
if (cfg.GOOGLE_PLAY_URL) { playLink.href = cfg.GOOGLE_PLAY_URL; } else { playLink.style.display = "none"; }
photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  if (!file) {
    preview.hidden = true;
  if (fileName) fileName.textContent = "Henüz dosya seçilmedi.";
    if (fileName) fileName.textContent = "Henüz dosya seçilmedi.";
    return;
  }
  if (fileName) fileName.textContent = file.name;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
});
newSuggestion.addEventListener("click", () => {
  success.hidden = true;
  form.hidden = false;
  form.reset();
  preview.hidden = true;
  if (fileName) fileName.textContent = "Henüz dosya seçilmedi.";
  window.scrollTo({ top: 0, behavior: "smooth" });
});
function requiredText(data, key) { return String(data.get(key) || "").trim(); }
async function uploadPhoto(file) {
  if (!file) return null;
  const ext = file.name.split(".").pop() || "jpg";
  const path = `suggestions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseClient.storage.from(cfg.SUPABASE_PHOTO_BUCKET || "suggestion-photos").upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;

      const { data } = supabaseClient.storage.from(cfg.SUPABASE_PHOTO_BUCKET || "suggestion-photos").getPublicUrl(path);
  return data?.publicUrl || null;
}
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";
  msg.className = "message";
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Gönderiliyor...</span>';
  try {
    if (!confirmCheck.checked) throw new Error("Lütfen bilgilerin doğruluğunu ve editör incelemesini kabul ediniz.");
    const data = new FormData(form);
    const required = [
      ["program_name", "Program adı gerekli."],
      ["venue_name", "Mekân adı gerekli."],
      ["district", "Lütfen ilçe seçiniz."],
      ["day", "Lütfen gün seçiniz."],
      ["time", "Saat bilgisi gerekli."],
      ["contact_name", "Yetkili / gönderen kişi adı gerekli."],
      ["contact_phone", "Telefon / WhatsApp bilgisi gerekli."]
    ];
    for (const [key, errorText] of required) {
      if (!requiredText(data, key)) throw new Error(errorText);
    }
    let photo_url = null;
    const file = photoInput.files?.[0];
    if (file) photo_url = await uploadPhoto(file);
    const payload = {
      program_name: requiredText(data, "program_name"),
      venue_name: requiredText(data, "venue_name"),
      district: requiredText(data, "district"),
      day: requiredText(data, "day"),
      time: requiredText(data, "time"),
      speaker: requiredText(data, "speaker") || null,
      organization: requiredText(data, "organization") || null,
      address: requiredText(data, "address") || null,
      google_maps_link: requiredText(data, "google_maps_link") || null,
      women_friendly: requiredText(data, "women_friendly") || "unknown",
      description: requiredText(data, "description") || null,
      contact_name: requiredText(data, "contact_name"),
      contact_phone: requiredText(data, "contact_phone"),
      photo_url,
      status: "pending",
      source: "web_form"
    };
    const { error } = await supabaseClient.from(cfg.SUPABASE_TABLE || "suggestions").insert(payload);
    if (error) throw error;
    try {
  const notifyResponse = await fetch("/.netlify/functions/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const notifyResult = await notifyResponse.json().catch(() => null);
  console.log("Telegram notify result:", notifyResult);
} catch (notifyError) {
  console.warn("Telegram notification failed:", notifyError);
}
    form.hidden = true;
    success.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error(err);
    msg.textContent = err.message || "Başvuru şu anda gönderilemedi. Lütfen tekrar deneyiniz.";
    msg.className = "message error";
  } finally {
    btn.disabled = false;
    btn.innerHTML = "<span>🌿</span><span>Öneriyi Gönder</span>";
  }
});
