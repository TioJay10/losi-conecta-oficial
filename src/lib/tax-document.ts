export function normalizeTaxDocument(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
}

export function formatTaxDocument(value: string): string {
  const v = normalizeTaxDocument(value);
  if (/^\d{0,11}$/.test(v)) {
    return v.replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2")
      .replace(/(\.\d{3})(\d{1,2})$/, "$1-$2");
  }
  return v.replace(/^(.{2})(.)/, "$1.$2")
    .replace(/^(.{2}\..{3})(.)/, "$1.$2")
    .replace(/^(.{2}\..{3}\..{3})(.)/, "$1/$2")
    .replace(/(\/.{4})(.{1,2})$/, "$1-$2");
}

export function isValidTaxDocument(value: string): boolean {
  const v = normalizeTaxDocument(value);
  if (/^(.)\1+$/.test(v)) return false;
  if (/^\d{11}$/.test(v)) {
    for (let size = 9; size <= 10; size++) {
      const sum = [...v.slice(0, size)].reduce((n, c, i) => n + Number(c) * (size + 1 - i), 0);
      const remainder = (sum * 10) % 11;
      if (Number(v[size]) !== (remainder === 10 ? 0 : remainder)) return false;
    }
    return true;
  }
  if (!/^[A-Z0-9]{12}\d{2}$/.test(v)) return false;
  for (let size = 12; size <= 13; size++) {
    const weights = size === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const sum = [...v.slice(0, size)].reduce((n, c, i) => n + (c.charCodeAt(0) - 48) * weights[i], 0);
    const remainder = sum % 11;
    if (Number(v[size]) !== (remainder < 2 ? 0 : 11 - remainder)) return false;
  }
  return true;
}
