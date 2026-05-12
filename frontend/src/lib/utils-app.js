// Persistent guest_id cookie (no expiry) — used for per-customer coupon tracking
export function getGuestId() {
  if (typeof document === 'undefined') return null;
  const cookies = Object.fromEntries(
    document.cookie.split('; ').filter(Boolean).map((c) => {
      const i = c.indexOf('=');
      return [c.slice(0, i), c.slice(i + 1)];
    }),
  );
  if (cookies.lamazi_guest_id) return cookies.lamazi_guest_id;
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'g-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  // 10 years
  const exp = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `lamazi_guest_id=${id}; expires=${exp}; path=/; SameSite=Lax`;
  return id;
}

export const fmtKWD = (n) => `${Number(n || 0).toFixed(3)} KWD`;
export const truncate = (s, max = 80) => (s && s.length > max ? s.slice(0, max - 1) + '…' : s);
