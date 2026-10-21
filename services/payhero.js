const axios = require("axios");
const { decryptCredential } = require("./credentialCrypto");

const PAYHERO_API = "https://backend.payhero.co.ke/api/v2";

function isPayHeroConfigured(operator) {
  return Boolean(
    operator?.payheroUsernameCiphertext &&
    operator?.payheroPasswordCiphertext &&
    operator?.payheroChannelId,
  );
}

function payheroAuth(operator) {
  if (!isPayHeroConfigured(operator)) throw new Error("PayHero is not configured for this operator.");
  return {
    username: decryptCredential(operator.payheroUsernameCiphertext),
    password: decryptCredential(operator.payheroPasswordCiphertext),
  };
}

async function initiatePayHeroPayment(operator, payment, callbackUrl) {
  const auth = payheroAuth(operator);
  const response = await axios.post(
    `${PAYHERO_API}/payments`,
    {
      amount: payment.amount,
      phone_number: payment.phone,
      channel_id: operator.payheroChannelId,
      provider: "m-pesa",
      external_reference: payment.transactionId,
      callback_url: callbackUrl,
    },
    { auth, timeout: 20000 },
  );

  const data = response.data?.data || response.data || {};
  const reference = data.reference || data.Reference || data.transaction_reference;
  const checkoutId = data.checkout_request_id || data.CheckoutRequestID || data.checkoutRequestId || null;
  if (response.data?.success === false || !reference) {
    throw new Error("PayHero did not return a transaction reference.");
  }

  return { reference: String(reference), checkoutId: checkoutId ? String(checkoutId) : null, raw: data };
}

async function getPayHeroTransactionStatus(operator, reference) {
  const response = await axios.get(`${PAYHERO_API}/transaction-status`, {
    auth: payheroAuth(operator),
    params: { reference },
    timeout: 15000,
  });
  return response.data?.data || response.data || {};
}

function payheroStatusSucceeded(statusData) {
  const status = String(statusData?.status || statusData?.Status || "").toUpperCase();
  return status === "SUCCESS" && statusData?.success !== false;
}

module.exports = {
  getPayHeroTransactionStatus,
  initiatePayHeroPayment,
  isPayHeroConfigured,
  payheroStatusSucceeded,
};
