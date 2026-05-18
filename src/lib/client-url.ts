/**
 * Builds an absolute URL for browser `fetch` calls. Vitest's undici layer rejects relative URLs.
 */
export function absoluteAppUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return `http://localhost:3000${p}`;
  }
  const { origin } = window.location;
  if (!origin || origin === "null") {
    return `http://localhost:3000${p}`;
  }
  return `${origin}${p}`;
}
