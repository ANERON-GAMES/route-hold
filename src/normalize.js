export function normalizePath(path) {
  if (typeof path !== "string") {
    throw new TypeError("path must be a string");
  }

  let normalized = path;
  if (normalized.endsWith("/.html")) {
    normalized = normalized.slice(0, -"/.html".length) + "/.";
  } else if (normalized.endsWith(".html") && !normalized.includes("/.")) {
    normalized = normalized.slice(0, -".html".length);
  }

  while (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
