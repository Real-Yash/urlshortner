export function projectName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length > 0 && name.length <= 100 ? name : null;
}

export function projectId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}
