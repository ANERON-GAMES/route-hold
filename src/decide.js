import { constantTimeEqual } from "./equal.js";
import { normalizePath } from "./normalize.js";

export const HOLD_PATH = "/maintenance";
export const HOME_PATH = "/";
export const API_ROOT = "/api";
export const REDIRECT_CACHE_CONTROL = "no-store, no-cache, must-revalidate, max-age=0";

export const DEFAULT_ADMIN_PREFIXES = Object.freeze(["/_/", "/_"]);

export const DEFAULT_ASSET_PATTERN =
  /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|webmanifest|json|txt)$/i;

export const RouteAction = Object.freeze({
  Next: "next",
  Redirect: "redirect"
});

export function decideRoute(input) {
  const request = readInput(input);
  const path = normalizePath(request.path);

  if (matchesApi(path) || matchesBoundedPrefix(path, request.adminPrefixes)) {
    return nextAction();
  }
  if (matchesAllowPrefix(path, request.allowPrefixes)) {
    return nextAction();
  }
  if (matchesAsset(path, request.assetPattern)) {
    return nextAction();
  }

  const maintenance = isMaintenanceEffective(request);
  if (maintenance && path !== request.holdPath) {
    return redirectAction(request.holdPath);
  }
  if (!maintenance && path === request.holdPath) {
    return redirectAction(request.homePath);
  }
  return nextAction();
}

function readInput(input) {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("input must be an object");
  }
  if (typeof input.path !== "string") {
    throw new TypeError("path must be a string");
  }
  if (typeof input.maintenance !== "boolean") {
    throw new TypeError("maintenance must be a boolean");
  }
  if (typeof input.presentedKey !== "string") {
    throw new TypeError("presentedKey must be a string");
  }
  if (typeof input.expectedKey !== "string") {
    throw new TypeError("expectedKey must be a string");
  }

  const allowPrefixes = readPrefixList(input.allowPrefixes, "allowPrefixes");
  const adminPrefixes = readPrefixList(
    input.adminPrefixes == null ? DEFAULT_ADMIN_PREFIXES : input.adminPrefixes,
    "adminPrefixes"
  );
  const holdPath = readRoutePath(input.holdPath, "holdPath", HOLD_PATH);
  const homePath = readRoutePath(input.homePath, "homePath", HOME_PATH);
  if (holdPath === homePath) {
    throw new TypeError("holdPath and homePath must be different");
  }

  return {
    path: input.path,
    maintenance: input.maintenance,
    presentedKey: input.presentedKey,
    expectedKey: input.expectedKey,
    allowPrefixes,
    adminPrefixes,
    assetPattern: readAssetPattern(input.assetPattern),
    holdPath,
    homePath
  };
}

function readPrefixList(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array of strings`);
  }
  const prefixes = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      throw new TypeError(`${label} must be an array of strings`);
    }
    const prefix = normalizePath(entry);
    if (prefix.length === 0) {
      throw new TypeError(`${label} entries must not normalize to an empty path`);
    }
    prefixes.push(prefix);
  }
  return prefixes;
}

function readRoutePath(value, label, fallback) {
  if (value == null) {
    return fallback;
  }
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a string`);
  }
  const path = normalizePath(value);
  if (path.length === 0) {
    throw new TypeError(`${label} must not normalize to an empty path`);
  }
  return path;
}

function readAssetPattern(value) {
  if (value == null) {
    return DEFAULT_ASSET_PATTERN;
  }
  if (!(value instanceof RegExp)) {
    throw new TypeError("assetPattern must be a regular expression");
  }
  return value;
}

function matchesApi(path) {
  return path === API_ROOT || path.startsWith(`${API_ROOT}/`);
}

function matchesBoundedPrefix(path, prefixes) {
  for (const prefix of prefixes) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

function matchesAllowPrefix(path, prefixes) {
  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function matchesAsset(path, pattern) {
  const flags = pattern.flags.replaceAll("g", "").replaceAll("y", "");
  return new RegExp(pattern.source, flags).test(path);
}

function isMaintenanceEffective(request) {
  if (request.maintenance !== true) {
    return false;
  }
  if (request.expectedKey.length === 0) {
    return true;
  }
  return !constantTimeEqual(request.presentedKey, request.expectedKey);
}

function nextAction() {
  return {
    action: RouteAction.Next
  };
}

function redirectAction(location) {
  return {
    action: RouteAction.Redirect,
    location,
    cacheControl: REDIRECT_CACHE_CONTROL
  };
}
