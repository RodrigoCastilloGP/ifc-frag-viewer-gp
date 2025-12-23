// src/app/url.ts

/**
 * Vite inyecta BASE_URL según `vite.config.ts -> base`.
 * En GH Pages Project Pages será: "/ifc-frag-viewer-gp/"
 * En dev normalmente: "/"
 */
export const BASE_URL = (import.meta.env.BASE_URL ?? "/").toString();

/**
 * Une `origin + BASE_URL` de forma segura, garantizando que termine en "/".
 * Ej:
 *  origin=https://x.com, BASE_URL=/ifc-frag-viewer-gp/
 *  -> https://x.com/ifc-frag-viewer-gp/
 */
export function getPublicBaseUrl(): string {
  const origin = window.location.origin;
  const base = BASE_URL.startsWith("/") ? BASE_URL : `/${BASE_URL}`;
  const baseWithSlash = base.endsWith("/") ? base : `${base}/`;
  return `${origin}${baseWithSlash}`;
}

/**
 * Resuelve un asset que está en `/public` usando BASE_URL,
 * devolviendo URL absoluta (ideal para Worker/WASM/GH Pages).
 *
 * Ej:
 *  resolvePublicUrl("models/v1/v1.frag")
 *  -> https://host/ifc-frag-viewer-gp/models/v1/v1.frag
 */
export function resolvePublicUrl(path: string): string {
  const clean = path.replace(/^\/+/, ""); // quita cualquier "/" inicial
  return new URL(clean, getPublicBaseUrl()).toString();
}

/**
 * Si ya es URL absoluta, la deja tal cual.
 * Si es relativa, la resuelve contra BASE_URL (public).
 */
export function resolveMaybeRelativeUrl(urlOrPath: string): string {
  const s = (urlOrPath ?? "").trim();
  if (!s) return resolvePublicUrl("");

  // Absolutas típicas
  if (/^(https?:)?\/\//i.test(s)) return s;        // http(s):// o //cdn...
  if (/^(blob:|data:)/i.test(s)) return s;         // casos especiales

  // Relativo: lo tratamos como asset público
  return resolvePublicUrl(s);
}

/**
 * (Opcional) Resuelve una ruta relativa contra una URL base específica.
 * Útil si algún día tus `url` del catálogo son relativos al models.json.
 */
export function resolveRelativeTo(relativePath: string, baseUrl: string): string {
  const clean = relativePath.replace(/^\/+/, "");
  return new URL(clean, baseUrl).toString();
}
