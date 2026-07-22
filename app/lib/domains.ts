export function platformSubdomain(value: unknown) {
  if (typeof value !== "string") return null;
  const subdomain = value.trim().toLowerCase();
  return /^(?!api$|www$|dashboard$)[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(subdomain) ? subdomain : null;
}
