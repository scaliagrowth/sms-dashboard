export function normalizePhone(input: string | null | undefined): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (input.trim().startsWith('+')) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function formatPhoneDisplay(input: string | null | undefined): string {
  const normalized = normalizePhone(input);
  if (!normalized) return '';

  const digits = normalized.replace(/^\+1/, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return normalized;
}
