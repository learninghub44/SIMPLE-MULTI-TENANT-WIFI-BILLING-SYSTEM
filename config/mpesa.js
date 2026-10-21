require("dotenv").config();
const axios = require("axios");
const moment = require("moment");

const MPESA_ENV = process.env.MPESA_ENV || "sandbox"; // "sandbox" or "production"
const MPESA_BASE_URL = MPESA_ENV === "sandbox" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke";

// ✅ Check if M-Pesa is enabled (for development, can be disabled)
const MPESA_ENABLED = process.env.MPESA_ENABLED !== "false";
const REQUIRED_DARAJA_ENV_VARS = [
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE",
    "MPESA_PASSKEY",
    "MPESA_CALLBACK_URL"
];

const isDarajaConfigured = () =>
    MPESA_ENABLED &&
    REQUIRED_DARAJA_ENV_VARS.every((name) => {
        const value = process.env[name];
        return Boolean(value && !value.startsWith("your_"));
    });

if (MPESA_ENABLED) {
    for (const varName of REQUIRED_DARAJA_ENV_VARS) {
        if (!process.env[varName] || process.env[varName].startsWith("your_")) {
            console.warn(`Missing or placeholder value for: ${varName}; Daraja checkout will be unavailable.`);
        }
    }
}

// ✅ Get access token
const getAccessToken = async () => {
    if (!isDarajaConfigured()) return null;
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");

    try {
        const response = await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
            headers: { Authorization: `Basic ${auth}` }
        });
        return response.data.access_token;
    } catch (error) {
        console.error("❌ MPesa Auth Error:", error.response ? error.response.data : error.message);
        return null;
    }
};

// ✅ STK Push
const stkPush = async (phone, amount, transactionId) => {
    if (!isDarajaConfigured()) return null;

    const accessToken = await getAccessToken();
    if (!accessToken) {
        console.error("❌ Failed to get MPesa access token. STK Push aborted.");
        return null;
    }

    const timestamp = moment().format("YYYYMMDDHHmmss");
    const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString("base64");

    const payload = {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: "WiFi Payment",
        TransactionDesc: `WiFi Payment - ${transactionId}`
    };

    try {
        const response = await axios.post(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (response.data.ResponseCode === "0") {
            return response.data;
        } else {
            console.error("❌ STK Push Failed:", response.data);
            return null;
        }
    } catch (error) {
        console.error("❌ MPesa STK Push Error:", error.response ? error.response.data : error.message);
        return null;
    }
};

module.exports = { isDarajaConfigured, stkPush };
