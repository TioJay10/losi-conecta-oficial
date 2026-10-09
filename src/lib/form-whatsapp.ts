/** National numbers include a DDD; explicitly international numbers retain their country code. */
export function formWhatsAppLink(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const phone = value.trim();
  if (!/^[+\d\s().-]+$/.test(phone)) return null;
  let digits = phone.replace(/\D/g, '');
  const international = phone.startsWith('+') || phone.startsWith('00');
  if (phone.startsWith('00')) digits = digits.slice(2);
  if (!international && (digits.length === 10 || digits.length === 11)) digits = '55' + digits;
  if (!/^[1-9]\d{9,14}$/.test(digits)) return null;
  return 'https://wa.me/' + digits;
}
