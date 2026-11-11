export const SCHOOL_LOGO_BUCKET = 'school-logos';
export const SCHOOL_LOGO_MAX_BYTES = 1024 * 1024;
export const SCHOOL_LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

type StorageClient = {
  storage: { from: (bucket: string) => { getPublicUrl: (path: string) => { data: { publicUrl: string } } } };
};

export function schoolLogoUrl(supabase: StorageClient, path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(SCHOOL_LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}
