const express = require("express");
const { randomUUID } = require("node:crypto");
const { rateLimit } = require("express-rate-limit");
const prisma = require("../config/prismaClient");
const { isDarajaConfigured, stkPush } = require("../config/mpesa");
const { routerSettingsConfigured } = require("../services/operatorRouter");
const { initiatePayHeroPayment, isPayHeroConfigured } = require("../services/payhero");

const router = express.Router();
const PACKAGE_AMOUNTS = new Set([10, 15, 20, 30]);
const paymentLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

router.post("/payments/initiate", paymentLimiter, async (req, res) => {
  const { phone, amount, macAddress } = req.body || {};
  const numericAmount = Number(amount);
  const normalizedPhone = String(phone || "").replace(/^\+/, "");
  const normalizedMac = String(macAddress || "").trim();

  if (!req.operator) {
    return res.status(403).json({ success: false, error: "Wi-Fi checkout must use an operator subdomain." });
  }
  if (!/^254(?:7|1)\d{8}$/.test(normalizedPhone)) {
    return res.status(400).json({ success: false, error: "Enter a valid Kenyan M-Pesa number." });
  }
  if (!PACKAGE_AMOUNTS.has(numericAmount) || !Number.isInteger(numericAmount)) {
    return res.status(400).json({ success: false, error: "Choose one of the available Wi-Fi packages." });
  }
  if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(normalizedMac)) {
    return res.status(400).json({ success: false, error: "A valid device MAC address is required for Wi-Fi access." });
  }

  let createdTransactionId = null;
  try {
    const operator = await prisma.operator.findUnique({ where: { id: req.operator.id } });
    if (!operator || operator.status !== "active") {
      return res.status(404).json({ success: false, error: "Operator account is not active." });
    }
    if (!routerSettingsConfigured(operator)) {
      return res.status(503).json({ success: false, error: "This operator has not configured a MikroTik router." });
    }

    const provider = isPayHeroConfigured(operator)
      ? "payhero"
      : isDarajaConfigured()
        ? "daraja"
        : null;
    if (!provider) {
      return res.status(503).json({
        success: false,
        error: "No payment provider is configured. Add PayHero settings or configure the platform Daraja credentials.",
      });
    }

    const transactionId = randomUUID();
    createdTransactionId = transactionId;
    const payment = await prisma.payment.create({
      data: {
        operatorId: operator.id,
        phone: normalizedPhone,
        amount: numericAmount,
        transactionId,
        macAddress: normalizedMac.toUpperCase(),
        status: "pending",
        provider,
        accessStatus: "pending",
      },
    });

    if (provider === "payhero") {
      const publicApiBase = String(process.env.PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");
      const protocol = process.env.NODE_ENV === "production" || req.secure ? "https" : "http";
      const callbackBase = publicApiBase || `${protocol}://${req.get("host")}`;
      const callbackUrl = `${callbackBase}/api/payhero/callback/${encodeURIComponent(operator.slug)}`;
      const result = await initiatePayHeroPayment(operator, payment, callbackUrl);
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerReference: result.reference,
          providerCheckoutId: result.checkoutId,
          mpesaRef: result.checkoutId || result.reference,
        },
      });
      return res.json({
        success: true,
        data: {
          transactionId,
          mpesaRef: result.checkoutId || result.reference,
          provider: "payhero",
          status: "pending",
          expiresAt: null,
        },
        message: "M-Pesa payment prompt sent.",
      });
    }

    const stkResponse = await stkPush(normalizedPhone, numericAmount, transactionId);
    const checkoutId = stkResponse?.CheckoutRequestID;
    if (!stkResponse || !checkoutId) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      return res.status(502).json({ success: false, error: "Daraja could not start the M-Pesa payment." });
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerCheckoutId: checkoutId, mpesaRef: checkoutId },
    });
    return res.json({
      success: true,
      data: {
        transactionId,
        mpesaRef: checkoutId,
        provider: "daraja",
        status: "pending",
        expiresAt: null,
      },
      message: "M-Pesa payment prompt sent.",
    });
  } catch (error) {
    if (createdTransactionId) {
      await prisma.payment.updateMany({
        where: { transactionId: createdTransactionId, status: "pending" },
        data: { status: "failed" },
      });
    }
    req.log?.error?.("Wi-Fi payment initiation failed", { operatorId: req.operator.id, error: error.message });
    return res.status(502).json({
      success: false,
      error: "Could not start the M-Pesa payment. Check the operator payment settings and try again.",
    });
  }
});

router.get("/payments/status/:transactionId", async (req, res) => {
  if (!req.operator) {
    return res.status(403).json({ success: false, error: "Use the operator subdomain for payment status." });
  }

  try {
    const payment = await prisma.payment.findFirst({
      where: { transactionId: req.params.transactionId, operatorId: req.operator.id },
      select: {
        status: true,
        accessStatus: true,
        mpesaRef: true,
        provider: true,
        providerReceipt: true,
        expiresAt: true,
      },
    });
    if (!payment) {
      return res.status(404).json({ success: false, error: "Payment not found." });
    }
    return res.json({
      success: true,
      data: {
        status: payment.status || "pending",
        accessStatus: payment.accessStatus,
        mpesaRef: payment.providerReceipt || payment.mpesaRef,
        provider: payment.provider,
        expiresAt: payment.expiresAt,
      },
    });
  } catch (error) {
    req.log?.error?.("Payment status lookup failed", { operatorId: req.operator.id, error: error.message });
    return res.status(500).json({ success: false, error: "Could not fetch payment status." });
  }
});

module.exports = router;
