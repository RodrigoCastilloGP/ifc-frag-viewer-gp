export const BASE_URL = (import.meta.env.BASE_URL ?? "/").toString();

/**
 * Resuelve un asset que está en /public usando BASE_URL,
 * devolviendo URL absoluta (ideal para Worker/WASM/GH Pages).
 */
export function resolvePublicUrl(path: string): string {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  // window.location.origin + BASE_URL -> "https://host/repo/" (en GH Pages)
  return new URL(clean, window.location.origin + BASE_URL).toString();
}

/**
 * Si ya es URL absoluta (http/https), la deja tal cual.
 * Si es relativa, la resuelve contra BASE_URL (public).
 */
export function resolveMaybeRelativeUrl(urlOrPath: string): string {
  try {
    return new URL(urlOrPath).toString();
  } catch {
    return resolvePublicUrl(urlOrPath);
  }
}
