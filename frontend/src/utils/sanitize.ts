const MAX_INPUT = 500;

export function sanitizeInput(value: string, maxLen = MAX_INPUT): string {
  return value
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/<[^>]*>/g, '')
    .slice(0, maxLen);
}
