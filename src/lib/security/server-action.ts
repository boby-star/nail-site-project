export function isPlausibleServerActionId(value: string) {
  return /^[A-Za-z0-9_-]{20,160}$/.test(value);
}
