import { supabase } from "@/integrations/supabase/client";

let cachedProfileData: { name: string; email: string; phone: string } | null = null;
let cacheUserId: string | null = null;

async function fetchAndCacheProfile() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      cachedProfileData = null;
      cacheUserId = null;
      return null;
    }

    if (cacheUserId === user.id && cachedProfileData) return cachedProfileData;

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, email, phone")
      .eq("id", user.id)
      .maybeSingle();

    const email = profile?.email || user.email || "";
    const name = profile?.username || profile?.display_name || user.user_metadata?.username || email;
    const phone =
      profile?.phone ||
      user.user_metadata?.phone ||
      user.user_metadata?.phone_number ||
      user.phone ||
      "";

    cachedProfileData = { name, email, phone };
    cacheUserId = user.id;
    return cachedProfileData;
  } catch {
    return null;
  }
}

/** Clear cached profile so it's re-fetched on next chat open */
export function invalidateChatProfileCache() {
  cachedProfileData = null;
  cacheUserId = null;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function getPhoneVariants(phone: string) {
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, "");
  const plusDigits = digits ? `+${digits}` : "";
  const withoutPlus = raw.replace(/^\+/, "");

  // numeric first: many pre-chat widgets expect only digits for phone
  return uniqueStrings([digits, plusDigits, raw, withoutPlus]);
}

function buildIdentityFormData(data: { name: string; email: string }) {
  return {
    name: data.name,
    full_name: data.name,
    fullName: data.name,
    customer_name: data.name,
    email: data.email,
    customer_email: data.email,
  };
}

function buildPhoneFormData(phone: string) {
  return {
    phone,
    phone_number: phone,
    phoneNumber: phone,
    phonenumber: phone,
    tel: phone,
    mobile: phone,
    telephone: phone,
    number: phone,
    contact: phone,
    contact_phone: phone,
    contactPhone: phone,
    contact_number: phone,
    contactNumber: phone,
    customer_phone: phone,
    customerPhone: phone,
    sdt: phone,
    so_dien_thoai: phone,
    "phone number": phone,
    "Phone Number": phone,
    "Số điện thoại": phone,
    "so dien thoai": phone,
  };
}

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  if (!value) return;
  if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) return;

  const current = (el.value || "").trim();
  if (current.length > 4 && current !== "+") return;

  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function isPhoneField(el: HTMLInputElement | HTMLTextAreaElement) {
  const meta = normalizeText(
    [
      el.name,
      el.id,
      el.placeholder,
      el.getAttribute("aria-label") || "",
      el.getAttribute("title") || "",
      (el as HTMLInputElement).autocomplete || "",
      (el as HTMLInputElement).inputMode || "",
      (el as HTMLInputElement).type || "",
    ]
      .filter(Boolean)
      .join(" "),
  );

  if ((el as HTMLInputElement).type === "tel") return true;
  if ((el as HTMLInputElement).autocomplete?.toLowerCase().includes("tel")) return true;
  if ((el as HTMLInputElement).inputMode === "tel") return true;

  const keywords = [
    "phone",
    "tel",
    "mobile",
    "telephone",
    "contact",
    "sdt",
    "so dien thoai",
    "dien thoai",
    "whatsapp",
    "zalo",
    "sms",
  ];

  return keywords.some((keyword) => meta.includes(keyword));
}

function fillPhoneInRoot(root: ParentNode, phone: string) {
  if (!phone) return;

  const phoneVariants = getPhoneVariants(phone);
  const inputs = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");

  inputs.forEach((el) => {
    const type = (el as HTMLInputElement).type?.toLowerCase();
    if (type === "hidden" || type === "password") return;
    if (!isPhoneField(el)) return;

    const maxLength = (el as HTMLInputElement).maxLength;
    const best =
      maxLength && maxLength > 0
        ? phoneVariants.find((v) => v.length <= maxLength) || phoneVariants[0]
        : phoneVariants[0];

    if (best) setInputValue(el, best);
  });
}

function tryFillPhoneInputs(phone: string) {
  try {
    fillPhoneInRoot(document, phone);

    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        const src = normalizeText(iframe.src || "");
        const id = normalizeText(iframe.id || "");
        const cls = normalizeText(iframe.className?.toString() || "");
        const looksLikePancake = src.includes("pancake") || id.includes("pancake") || cls.includes("pancake");
        if (!looksLikePancake) return;

        const doc = iframe.contentDocument;
        if (!doc) return;
        fillPhoneInRoot(doc, phone);
      } catch {
        // ignore cross-origin iframe access errors
      }
    });
  } catch {
    // noop
  }
}

function prefillProfileForChat(data: { name: string; email: string; phone: string }) {
  try {
    // keep currently working fields
    window.PancakeChatPlugin?.setInitialFormData(buildIdentityFormData(data));

    // send phone from profile as dedicated payload
    const phoneVariants = getPhoneVariants(data.phone);
    const primaryPhone = phoneVariants[0] || "";
    if (primaryPhone) {
      window.PancakeChatPlugin?.setInitialFormData(buildPhoneFormData(primaryPhone));

      // also send single-key payloads to cover strict widgets
      window.PancakeChatPlugin?.setInitialFormData({ phone: primaryPhone });
      window.PancakeChatPlugin?.setInitialFormData({ phone_number: primaryPhone });
      window.PancakeChatPlugin?.setInitialFormData({ phoneNumber: primaryPhone });
      window.PancakeChatPlugin?.setInitialFormData({ tel: primaryPhone });
      window.PancakeChatPlugin?.setInitialFormData({ sdt: primaryPhone });
    }
  } catch {
    // noop
  }
}

function schedulePrefillRetries(data: { name: string; email: string; phone: string }) {
  const delays = [0, 150, 400, 900, 1600, 2600, 3800];

  delays.forEach((delay) => {
    window.setTimeout(() => {
      prefillProfileForChat(data);
      tryFillPhoneInputs(data.phone);
    }, delay);
  });
}

/**
 * Opens Pancake Chat and auto-fills user profile data (name, email, phone)
 */
export async function openChatWithProfile() {
  try {
    const data = await fetchAndCacheProfile();

    if (data) {
      // prefill before open
      schedulePrefillRetries(data);
    }

    window.PancakeChatPlugin?.openChatBox();

    if (data) {
      // prefill after open when form mounts
      window.setTimeout(() => schedulePrefillRetries(data), 250);
    }
  } catch {
    try {
      window.PancakeChatPlugin?.openChatBox();
    } catch {
      // noop
    }
  }
}

function hasPancakeMarker(value: string) {
  const v = normalizeText(value);
  return v.includes("pancake") || v.includes("chat-widget") || v.includes("livechat");
}

function pathLooksLikeWidget(path: EventTarget[]) {
  return path.some((node) => {
    if (!(node instanceof HTMLElement)) return false;
    return hasPancakeMarker([node.id, node.className?.toString() || "", node.getAttribute("aria-label") || ""].join(" "));
  });
}

/**
 * Sets up a global click interceptor on the Pancake Chat floating bubble
 * so profile data is auto-filled even when users click it directly.
 */
let interceptorActive = false;
export function setupChatBubbleInterceptor() {
  if (interceptorActive) return;
  interceptorActive = true;

  document.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement | null;
      const widgetRoot = target?.closest("[id*='pancake'], [class*='pancake'], [id*='chat-widget'], [class*='chat-widget']");
      const fromWidgetPath = pathLooksLikeWidget((e.composedPath?.() || []) as EventTarget[]);

      if (!widgetRoot && !fromWidgetPath) return;

      const data = await fetchAndCacheProfile();
      if (!data) return;

      schedulePrefillRetries(data);
    },
    true,
  );

  let mutationDebounceTimer: number | null = null;

  const observer = new MutationObserver(async (mutations) => {
    const hasRelevantNode = mutations.some((mutation) =>
      Array.from(mutation.addedNodes).some((node) => {
        if (!(node instanceof HTMLElement)) return false;

        return (
          hasPancakeMarker(`${node.id} ${node.className?.toString() || ""}`) ||
          !!node.querySelector("iframe, input, textarea, [id*='pancake'], [class*='pancake'], [id*='chat-widget'], [class*='chat-widget']")
        );
      }),
    );

    if (!hasRelevantNode) return;

    if (mutationDebounceTimer) {
      window.clearTimeout(mutationDebounceTimer);
    }

    mutationDebounceTimer = window.setTimeout(async () => {
      const data = await fetchAndCacheProfile();
      if (!data) return;
      schedulePrefillRetries(data);
    }, 120);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
