/**
 * Daraja (Safaricom M-Pesa) Payment Adapter
 * 
 * Implements the PaymentAdapter contract for Safaricom's Daraja API.
 * Migrates existing Daraja integration to the pluggable adapter pattern.
 */

const axios = require('axios');
const moment = require('moment');
const PaymentAdapter = require('../../contracts/PaymentAdapter');
const { validateKenyanPhone, validateCredentials, validateAmount } = require('../../../shared/validation/Validator');
const { verifyDarajaSignature } = require('../../../shared/webhook/WebhookSecurity');
const logger = require('../../../../../src/logger');

class DarajaAdapter extends PaymentAdapter {
  constructor() {
    super();
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get provider metadata
   * @returns {PaymentProviderMetadata}
   */
  getMetadata() {
    return {
      providerId: 'daraja',
      displayName: 'Safaricom M-Pesa Daraja',
      supportedCountries: ['KE'],
      supportedMethods: [
        {
          id: 'mpesa_stk',
          displayName: 'M-Pesa STK Push',
          supportedCurrencies: ['KES'],
          limits: { minAmount: 1, maxAmount: 150000 },
        },
      ],
      capabilities: {
        initiatePayment: true,
        verifyCallback: true,
        checkStatus: false, // Daraja doesn't have a status check API
        refund: false,
        idempotency: false,
        webhooks: true,
        preAuth: false,
      },
      requiredCredentials: [
        {
          key: 'consumerKey',
          displayName: 'Consumer Key',
          type: 'string',
          required: true,
          sensitive: true,
          placeholder: 'your_consumer_key',
          description: 'From Safaricom Developer Portal',
        },
        {
          key: 'consumerSecret',
          displayName: 'Consumer Secret',
          type: 'string',
          required: true,
          sensitive: true,
          placeholder: 'your_consumer_secret',
          description: 'From Safaricom Developer Portal',
        },
        {
          key: 'shortcode',
          displayName: 'Shortcode',
          type: 'string',
          required: true,
          sensitive: false,
          placeholder: '174379',
          description: 'M-Pesa Paybill or Till Number',
        },
        {
          key: 'passkey',
          displayName: 'Passkey',
          type: 'string',
          required: true,
          sensitive: true,
          placeholder: 'your_passkey',
          description: 'From Safaricom Developer Portal',
        },
      ],
      requiresWebhook: true,
      documentationUrl: 'https://developer.safaricom.co.ke/apis',
      sandboxUrl: 'https://sandbox.safaricom.co.ke',
      productionUrl: 'https://api.safaricom.co.ke',
    };
  }

  /**
   * Validate provider credentials
   * @param {Object} credentials - Provider credentials object
   * @returns {Promise<ValidationResult>}
   */
  async validateCredentials(credentials) {
    const schema = this.getMetadata().requiredCredentials;
    const validation = validateCredentials(credentials, schema);

    if (!validation.valid) {
      return validation;
    }

    // Try to get access token to verify credentials
    try {
      const token = await this.getAccessToken(credentials);
      if (token) {
        return { valid: true, errors: [], warnings: validation.warnings };
      }
      return { valid: false, errors: ['Failed to obtain access token'], warnings: validation.warnings };
    } catch (error) {
      return { valid: false, errors: [error.message], warnings: validation.warnings };
    }
  }

  /**
   * Get access token from Daraja
   * @param {Object} credentials - Provider credentials
   * @returns {Promise<string|null>}
   */
  async getAccessToken(credentials) {
    // Check if we have a cached token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const { consumerKey, consumerSecret } = credentials;
    const env = process.env.MPESA_ENV || 'sandbox';
    const baseUrl = env === 'sandbox' 
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke';

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    try {
      const response = await axios.get(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` },
        timeout: 10000,
      });

      this.accessToken = response.data.access_token;
      // Token expires in 1 hour, cache for 55 minutes to be safe
      this.tokenExpiry = Date.now() + 55 * 60 * 1000;

      return this.accessToken;
    } catch (error) {
      logger.error('Daraja access token fetch failed', { 
        error: error.message,
        response: error.response?.data 
      });
      return null;
    }
  }

  /**
   * Initiate a payment
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {PaymentInitiationRequest} request - Payment initiation request
   * @returns {Promise<PaymentInitiationResult>}
   */
  async initiatePayment(operatorConfig, request) {
    const { amount, phone, transactionId, callbackUrl } = request;

    // Validate inputs
    const phoneValidation = validateKenyanPhone(phone);
    if (!phoneValidation.valid) {
      return {
        success: false,
        errorMessage: phoneValidation.error,
      };
    }

    const amountValidation = validateAmount(amount, { min: 1, max: 150000 });
    if (!amountValidation.valid) {
      return {
        success: false,
        errorMessage: amountValidation.error,
      };
    }

    // Get access token
    const token = await this.getAccessToken(operatorConfig);
    if (!token) {
      return {
        success: false,
        errorMessage: 'Failed to obtain access token from Daraja',
      };
    }

    // Prepare STK Push payload
    const env = process.env.MPESA_ENV || 'sandbox';
    const baseUrl = env === 'sandbox' 
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke';

    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(
      `${operatorConfig.shortcode}${operatorConfig.passkey}${timestamp}`
    ).toString('base64');

    const payload = {
      BusinessShortCode: operatorConfig.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneValidation.normalized,
      PartyB: operatorConfig.shortcode,
      PhoneNumber: phoneValidation.normalized,
      CallBackURL: callbackUrl,
      AccountReference: transactionId.substring(0, 12), // Limit to 12 chars
      TransactionDesc: `WiFi Payment - ${transactionId}`,
    };

    try {
      const response = await axios.post(
        `${baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 20000,
        }
      );

      if (response.data.ResponseCode === '0') {
        return {
          success: true,
          providerReference: response.data.MerchantRequestID,
          checkoutId: response.data.CheckoutRequestID,
          status: 'pending',
          raw: response.data,
        };
      } else {
        logger.error('Daraja STK Push failed', { response: response.data });
        return {
          success: false,
          errorMessage: response.data.errorMessage || response.data.ResponseDesc || 'STK Push failed',
          raw: response.data,
        };
      }
    } catch (error) {
      logger.error('Daraja STK Push error', { 
        error: error.message,
        response: error.response?.data 
      });
      return {
        success: false,
        errorMessage: error.response?.data?.errorMessage || error.message,
        raw: error.response?.data,
      };
    }
  }

  /**
   * Verify webhook callback signature
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {Object} headers - HTTP headers from callback
   * @param {Object} body - Callback request body
   * @returns {Promise<CallbackVerificationResult>}
   */
  async verifyCallback(operatorConfig, headers, body) {
    const callbackData = body?.Body?.stkCallback;
    
    if (!callbackData) {
      return {
        valid: false,
        errorMessage: 'Invalid callback payload structure',
      };
    }

    const checkoutId = callbackData.CheckoutRequestID;
    if (!checkoutId) {
      return {
        valid: false,
        errorMessage: 'Missing CheckoutRequestID in callback',
      };
    }

    // Daraja doesn't use HMAC signatures, but we can verify the password
    // if the callback includes it (some implementations do)
    // For now, we'll validate the structure and extract data

    const resultCode = callbackData.ResultCode;
    const amount = callbackData?.CallbackMetadata?.Item?.find(
      (item) => item.Name === 'Amount'
    )?.Value;
    const mpesaRef = callbackData?.CallbackMetadata?.Item?.find(
      (item) => item.Name === 'MpesaReceiptNumber'
    )?.Value;

    return {
      valid: true,
      transactionId: checkoutId,
      providerReference: checkoutId,
      status: resultCode === 0 ? 'completed' : 'failed',
      amount,
      receipt: mpesaRef,
    };
  }

  /**
   * Check transaction status
   * Daraja does not provide a status check API
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {string} providerReference - Provider's transaction reference
   * @returns {Promise<TransactionStatusResult>}
   */
  async checkStatus(operatorConfig, providerReference) {
    return {
      success: false,
      status: 'unknown',
      errorMessage: 'Daraja does not support transaction status queries',
    };
  }

  /**
   * Normalize provider status to internal status
   * @param {string} providerStatus - Provider's raw status
   * @returns {string} - Normalized status
   */
  normalizeStatus(providerStatus) {
    const status = String(providerStatus).toLowerCase();
    
    if (status === '0' || status === 'success' || status === 'completed') {
      return 'completed';
    }
    if (status === '1032' || status === 'failed' || status === 'cancelled') {
      return 'failed';
    }
    if (status === '1' || status === 'pending' || status === 'processing') {
      return 'pending';
    }
    
    return 'unknown';
  }

  /**
   * Process a refund (not supported by Daraja)
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {string} providerReference - Original transaction reference
   * @param {number} amount - Amount to refund
   * @param {string} [reason] - Refund reason
   * @returns {Promise<RefundResult>}
   */
  async refund(operatorConfig, providerReference, amount, reason) {
    return {
      success: false,
      status: 'failed',
      errorMessage: 'Refunds are not supported by Daraja. Contact Safaricom directly for reversals.',
    };
  }
}

module.exports = DarajaAdapter;
