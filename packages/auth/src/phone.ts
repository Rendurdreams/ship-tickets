export function normalizeE164Phone(phone: string): string | null {
  const normalized = phone.trim().replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}
