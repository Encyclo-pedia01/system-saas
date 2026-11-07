// Only same-site relative paths are honoured after sign-in or password setup.
export function safeNextPath(value: FormDataEntryValue | string | null | undefined, fallback = '/dashboard'): string {
  if (typeof value !== 'string') return fallback;
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : fallback;
}
