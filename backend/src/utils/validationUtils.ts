/**
 * Validate Thai citizen ID format and checksum (Mod 11).
 */
export function isValidCitizenId(citizenId: string): boolean {
  const regex = /^\d{13}$/;
  if (!regex.test(citizenId)) {
    return false;
  }

  const digits = citizenId.split('').map((d) => parseInt(d, 10));
  const sum = digits.slice(0, 12).reduce((acc, digit, idx) => {
    const weight = 13 - idx;
    return acc + digit * weight;
  }, 0);
  const checksum = (11 - (sum % 11)) % 10;

  return checksum === digits[12];
}
