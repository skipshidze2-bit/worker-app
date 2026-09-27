/** Georgian IBAN: GE, 2 check digits, 2-letter bank code, 16 digits. */
export function normalizeIban(input: string): string | null {
  const iban = input.replace(/\s+/g, '').toUpperCase();
  if (!/^GE\d{2}[A-Z]{2}\d{16}$/.test(iban)) return null;
  // ISO 7064 mod-97 check
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
  return rem === 1 ? iban : null;
}
