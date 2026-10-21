const express = require("express");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");
const prisma = require("../config/prismaClient");
const { encryptCredential } = require("../services/credentialCrypto");
const { validateOperatorSlug } = require("../services/operatorHost");
const { validateRouterHostname } = require("../services/safeRouterHost");
const { testOperatorRouter } = require("../services/operatorRouter");
const {
  getAuthenticatedOperator,
  issueOperatorToken,
  requireOperatorAuth,
} = require("../middleware/operatorAuth");

const router = express.Router();
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false });
const RESERVED_EMAILS = new Set(["admin", "support", "info", "billing", "operator", "root", "security", "www"]);

function publicOperator(operator) {
  const baseDomain = String(process.env.OPERATOR_BASE_DOMAIN || "").trim().toLowerCase();
  return {
    id: operator.id,
    businessName: operator.businessName,
    slug: operator.slug,
    email: operator.email,
    subdomainUrl: baseDomain ? `https://${operator.slug}.${baseDomain}` : null,
    domainReady: Boolean(baseDomain),
  };
}

function operatorFromRequest(req, res) {
  return getAuthenticatedOperator(req).then((operator) => {
    if (!operator) res.status(404).json({ success: false, error: "Operator account not found." });
    return operator;
  });
}

router.post("/register", signupLimiter, async (req, res) => {
  if (req.operator) {
    return res.status(400).json({ success: false, error: "Create operator accounts from the platform domain." });
  }

  const businessName = String(req.body?.businessName || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const requestedSlug = req.body?.slug || req.body?.subdomain;
  const slugResult = validateOperatorSlug(requestedSlug);

  if (businessName.length < 2 || businessName.length > 80) {
    return res.status(400).json({ success: false, error: "Business name must be between 2 and 80 characters." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: "Enter a valid email address." });
  }
  if (RESERVED_EMAILS.has(email.split("@")[0])) {
    return res.status(400).json({ success: false, error: "That email address cannot be used for an operator account." });
  }
  if (password.length < 10 || password.length > 128) {
    return res.status(400).json({ success: false, error: "Password must be between 10 and 128 characters." });
  }
  if (!slugResult.valid) {
    return res.status(400).json({ success: false, error: slugResult.error });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const operator = await prisma.operator.create({
      data: { businessName, email, slug: slugResult.value, passwordHash },
    });
    const token = issueOperatorToken(operator);
    res.status(201).json({ success: true, data: { operator: publicOperator(operator), token } });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: "That email or subdomain is already registered. Choose another.",
      });
    }
    req.log?.error?.("Operator signup failed", { error: error.message });
    return res.status(500).json({ success: false, error: "Could not create the operator account." });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Enter your email and password." });
  }

  try {
    const operator = await prisma.operator.findUnique({ where: { email } });
    if (!operator || operator.status !== "active" || !(await bcrypt.compare(password, operator.passwordHash))) {
      return res.status(401).json({ success: false, error: "Email or password is incorrect." });
    }
    if (req.operator && req.operator.id !== operator.id) {
      return res.status(401).json({ success: false, error: "This operator account does not match this subdomain." });
    }
    return res.json({ success: true, data: { operator: publicOperator(operator), token: issueOperatorToken(operator) } });
  } catch (error) {
    req.log?.error?.("Operator login failed", { error: error.message });
    return res.status(500).json({ success: false, error: "Could not sign in." });
  }
});

router.get("/public", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    success: true,
    data: {
      operator: req.operator
        ? { businessName: req.operator.businessName, slug: req.operator.slug }
        : null,
    },
  });
});

router.use(requireOperatorAuth);

router.get("/me", async (req, res) => {
  try {
    const operator = await operatorFromRequest(req, res);
    if (!operator) return;
    return res.json({ success: true, data: { operator: publicOperator(operator) } });
  } catch (error) {
    req.log?.error?.("Operator profile lookup failed", { error: error.message });
    return res.status(500).json({ success: false, error: "Could not load the operator account." });
  }
});

router.get("/integrations", async (req, res) => {
  try {
    const operator = await operatorFromRequest(req, res);
    if (!operator) return;
    const payheroConfigured = Boolean(
      operator.payheroUsernameCiphertext &&
      operator.payheroPasswordCiphertext &&
      operator.payheroChannelId,
    );
    const mikrotikConfigured = Boolean(
      operator.mikrotikHost &&
      operator.mikrotikUsernameCiphertext &&
      operator.mikrotikPasswordCiphertext,
    );

    return res.json({
      success: true,
      data: {
        payhero: {
          configured: payheroConfigured,
          usernameHint: operator.payheroUsernameCiphertext ? "Saved" : "",
          channelId: operator.payheroChannelId || null,
        },
        mikrotik: {
          configured: mikrotikConfigured,
          host: operator.mikrotikHost || "",
          port: operator.mikrotikPort || 8728,
          usernameHint: operator.mikrotikUsernameCiphertext ? "Saved" : "",
        },
      },
    });
  } catch (error) {
    req.log?.error?.("Operator integration lookup failed", { error: error.message });
    return res.status(500).json({ success: false, error: "Could not load integration settings." });
  }
});

router.put("/payhero", async (req, res) => {
  try {
    const operator = await operatorFromRequest(req, res);
    if (!operator) return;

    const username = String(req.body?.apiUsername || "").trim();
    const password = String(req.body?.apiPassword || "");
    const channelIdText = req.body?.channelId;
    const channelId = channelIdText === undefined || channelIdText === "" ? operator.payheroChannelId : Number(channelIdText);
    const nextUsername = username ? encryptCredential(username) : operator.payheroUsernameCiphertext;
    const nextPassword = password ? encryptCredential(password) : operator.payheroPasswordCiphertext;

    if (!nextUsername || !nextPassword || !Number.isInteger(channelId) || channelId <= 0) {
      return res.status(400).json({
        success: false,
        error: "Enter PayHero API username, API password, and a positive channel ID to enable PayHero.",
      });
    }

    await prisma.operator.update({
      where: { id: operator.id },
      data: {
        payheroUsernameCiphertext: nextUsername,
        payheroPasswordCiphertext: nextPassword,
        payheroChannelId: channelId,
      },
    });
    return res.json({ success: true, message: "PayHero settings saved." });
  } catch (error) {
    req.log?.error?.("PayHero settings update failed", { error: error.message });
    return res.status(500).json({ success: false, error: "Could not save PayHero settings." });
  }
});

router.delete("/payhero", async (req, res) => {
  try {
    const operator = await operatorFromRequest(req, res);
    if (!operator) return;
    await prisma.operator.update({
      where: { id: operator.id },
      data: {
        payheroUsernameCiphertext: null,
        payheroPasswordCiphertext: null,
        payheroChannelId: null,
      },
    });
    return res.json({ success: true, message: "PayHero settings removed." });
  } catch (error) {
    req.log?.error?.("PayHero settings removal failed", { error: error.message });
    return res.status(500).json({ success: false, error: "Could not remove PayHero settings." });
  }
});

router.put("/mikrotik", async (req, res) => {
  try {
    const operator = await operatorFromRequest(req, res);
    if (!operator) return;

    const hostText = String(req.body?.host || "").trim();
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const host = hostText ? validateRouterHostname(hostText) : operator.mikrotikHost;
    const nextUsername = username ? encryptCredential(username) : operator.mikrotikUsernameCiphertext;
    const nextPassword = password ? encryptCredential(password) : operator.mikrotikPasswordCiphertext;

    if (!host || !nextUsername || !nextPassword) {
      return res.status(400).json({
        success: false,
        error: "Enter a router hostname or IPv4 address, API username, and API password.",
      });
    }

    await prisma.operator.update({
      where: { id: operator.id },
      data: {
        mikrotikHost: host,
        mikrotikUsernameCiphertext: nextUsername,
        mikrotikPasswordCiphertext: nextPassword,
        mikrotikPort: 8728,
      },
    });
    return res.json({
      success: true,
      message: "MikroTik settings saved. Test the connection before accepting payments.",
    });
  } catch (error) {
    const clientError = /Enter a public|Enter a valid/.test(error.message || "");
    return res.status(clientError ? 400 : 500).json({
      success: false,
      error: clientError ? error.message : "Could not save MikroTik settings.",
    });
  }
});

router.delete("/mikrotik", async (req, res) => {
  try {
    const operator = await operatorFromRequest(req, res);
    if (!operator) return;
    await prisma.operator.update({
      where: { id: operator.id },
      data: {
        mikrotikHost: null,
        mikrotikUsernameCiphertext: null,
        mikrotikPasswordCiphertext: null,
        mikrotikPort: null,
      },
    });
    return res.json({ success: true, message: "MikroTik settings removed." });
  } catch (error) {
    req.log?.error?.("MikroTik settings removal failed", { error: error.message });
    return res.status(500).json({ success: false, error: "Could not remove MikroTik settings." });
  }
});

router.post("/mikrotik/test", async (req, res) => {
  try {
    const operator = await operatorFromRequest(req, res);
    if (!operator) return;
    const result = await testOperatorRouter(operator);
    if (!result.success) return res.status(502).json({ success: false, error: result.message });
    return res.json({ success: true, message: result.message });
  } catch (_error) {
    return res.status(502).json({
      success: false,
      error: "Router connection failed. Confirm the host resolves publicly, port 8728 is reachable, and API credentials are correct.",
    });
  }
});

module.exports = router;
