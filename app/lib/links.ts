export const codePattern = /^[A-Za-z0-9_-]{4,64}$/;
export const reservedCodes = new Set(["api", "app", "login", "health", "favicon.ico", "robots.txt"]);

export function destinationUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export function customCode(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const code = value.trim().toLowerCase();
  return codePattern.test(code) && !reservedCodes.has(code) ? code : null;
}
