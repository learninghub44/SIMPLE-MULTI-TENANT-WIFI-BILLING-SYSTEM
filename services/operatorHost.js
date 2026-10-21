const RESERVED_OPERATOR_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "billing",
  "help",
  "mail",
  "operator",
  "platform",
  "portal",
  "status",
  "support",
  "www",
]);

function normalizedHostname(hostHeader = "") {
  return String(hostHeader)
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/:\d+$/, "");
}

function getOperatorHostContext(hostHeader, baseDomain = process.env.OPERATOR_BASE_DOMAIN, nodeEnv = process.env.NODE_ENV) {
  const hostname = normalizedHostname(hostHeader);
  const normalizedBase = String(baseDomain || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");

  if (normalizedBase) {
    if (hostname === normalizedBase || hostname === `www.${normalizedBase}`) {
      return { kind: "platform" };
    }

    if (hostname.endsWith(`.${normalizedBase}`)) {
      const slug = hostname.slice(0, -(normalizedBase.length + 1));
      if (!slug || slug.includes(".")) return { kind: "invalid" };
      if (RESERVED_OPERATOR_SLUGS.has(slug)) return { kind: "platform" };
      return { kind: "operator", slug };
    }
  }

  if (nodeEnv !== "production" && hostname.endsWith(".localhost")) {
    const slug = hostname.slice(0, -".localhost".length);
    if (slug && !slug.includes(".")) return { kind: "operator", slug };
  }

  return { kind: "platform" };
}

function validateOperatorSlug(slug) {
  const value = String(slug || "").trim().toLowerCase();
  if (!/^(?=.{2,40}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/.test(value)) {
    return { valid: false, value, error: "Choose a subdomain using 2–40 lowercase letters, numbers, or hyphens." };
  }
  if (RESERVED_OPERATOR_SLUGS.has(value)) {
    return { valid: false, value, error: "That subdomain is reserved. Choose another one." };
  }
  return { valid: true, value };
}

module.exports = { getOperatorHostContext, normalizedHostname, validateOperatorSlug };
