const express = require("express");
const prisma = require("../config/prismaClient");
const logger = require("../src/logger");
const {
  getPayHeroTransactionStatus,
  payheroStatusSucceeded,
} = require("../services/payhero");
const { completeWifiPayment } = require("../services/paymentCompletion");

const router = express.Router();

async function handlePayHeroCallback(req, res) {
  const callback = req.body?.response || req.body || {};
  const transactionId = String(callback.ExternalReference || callback.external_reference || "");
  const checkoutId = callback.CheckoutRequestID || callback.checkout_request_id || null;
  const callbackStatus = String(callback.Status || callback.status || "").toUpperCase();
  if (!transactionId) {
    return res.status(400).json({ success: false, error: "Missing external transaction reference." });
  }

  try {
    const operatorSlug = req.params.operatorSlug || req.operator?.slug;
    if (!operatorSlug) {
      return res.status(404).json({ success: false, error: "Operator callback route is required." });
    }
    const callbackOperator = await prisma.operator.findUnique({ where: { slug: operatorSlug } });
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: { operator: true },
    });
    if (
      !callbackOperator ||
      !payment ||
      payment.operatorId !== callbackOperator.id ||
      payment.provider !== "payhero" ||
      !payment.operator
    ) {
      return res.status(404).json({ success: false, error: "Payment not found." });
    }
    if (checkoutId && payment.providerCheckoutId && String(checkoutId) !== payment.providerCheckoutId) {
      return res.status(400).json({ success: false, error: "Checkout reference did not match." });
    }

    const callbackAmount = Number(callback.Amount ?? callback.amount);
    if (callbackAmount !== payment.amount) {
      logger.warn("PayHero callback amount mismatch", { transactionId, expected: payment.amount });
      return res.status(400).json({ success: false, error: "Payment amount did not match." });
    }

    if (callbackStatus && !["SUCCESS", "COMPLETED"].includes(callbackStatus)) {
      await prisma.payment.updateMany({
        where: { id: payment.id, status: "pending" },
        data: { status: "failed" },
      });
      return res.json({ success: true, message: "Payment was not successful." });
    }

    const reference = payment.providerReference;
    if (!reference) {
      return res.status(400).json({ success: false, error: "PayHero reference is missing." });
    }
    const providerStatus = await getPayHeroTransactionStatus(payment.operator, reference);
    if (!payheroStatusSucceeded(providerStatus)) {
      return res.status(202).json({ success: true, message: "Payment is not confirmed yet." });
    }

    const receipt =
      callback.MpesaReceiptNumber ||
      callback.mpesa_receipt_number ||
      providerStatus.provider_reference ||
      providerStatus.receipt ||
      null;
    const result = await completeWifiPayment(payment, receipt, reference);
    return res.json({
      success: true,
      message: result.accessStatus === "granted"
        ? "Payment verified and Wi-Fi access provisioned."
        : "Payment verified; Wi-Fi access provisioning needs attention.",
    });
  } catch (error) {
    logger.error("PayHero callback processing failed", { transactionId, error: error.message });
    return res.status(500).json({ success: false, error: "Callback processing failed." });
  }
}

router.post("/payhero/callback", handlePayHeroCallback);
router.post("/payhero/callback/:operatorSlug", handlePayHeroCallback);

module.exports = router;
