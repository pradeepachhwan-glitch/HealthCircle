export const SUPPORT_EMAIL = "yukticare.support@gmail.com";
export const SUPPORT_WHATSAPP = "919278347143";

export const SUPPORT_WHATSAPP_DISPLAY = "+91 92783 47143";

export function mailtoUrl(subject?: string, body?: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const qs = params.toString();
  return `mailto:${SUPPORT_EMAIL}${qs ? `?${qs}` : ""}`;
}

export function whatsappUrl(text?: string): string {
  const base = `https://wa.me/${SUPPORT_WHATSAPP}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
