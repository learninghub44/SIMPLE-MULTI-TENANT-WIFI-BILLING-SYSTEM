/**
 * PayHero Payment Adapter
 * 
 * Implements the PaymentAdapter contract for PayHero payment gateway.
 * Migrates existing PayHero integration to the pluggable adapter pattern.
 */

const axios = require('axios');
const PaymentAdapter = require('../../contracts/PaymentAdapter');
const { decryptCredential } = require('../../../../../services/credentialCrypto');
const { validateKenyanPhone, validateAmount, validateCredentials } = require('../../../shared/validation/Validator');
const logger = require('../../../../../src/logger');

const PAYHERO_API = 'https://backend.payhero.co.ke/api/v2';

class PayHeroAdapter extends PaymentAdapter {
  /**
   * Get provider metadata
   * @returns {PaymentProviderMetadata}
   */
  getMetadata() {
    return {
      providerId: 'payhero',
      displayName: 'PayHero',
      supportedCountries: ['KE'],
      supportedMethods: [
        {
          id: 'mpesa',
          displayName: 'M-Pesa',
          supportedCurrencies: ['KES'],
          limits: { minAmount: 10, maxAmount: 150000 },
        },
      ],
      capabilities: {
        initiatePayment: true,
        verifyCallback: true,
        checkStatus: true,
        refund: false,
        idempotency: false,
        webhooks: true,
        preAuth: false,
      },
      requiredCredentials: [
        {
          key: 'username',
          displayName: 'Username',
          type: 'string',
          required: true,
          sensitive: true,
          placeholder: 'your_payhero_username',
          description: 'PayHero account username',
        },
        {
          key: 'password',
          displayName: 'Password',
          type: 'string',
          required: true,
          sensitive: true,
          placeholder: 'your_payhero_password',
          description: 'PayHero account password',
        },
        {
          key: 'channelId',
          displayName: 'Channel ID',
          type: 'number',
          required: true,
          sensitive: false,
          placeholder: '12345',
          description: 'PayHero payment channel ID',
        },
      ],
      requiresWebhook: true,
      documentationUrl: 'https://payhero.co.ke/developers',
      sandboxUrl: 'https://backend.payhero.co.ke/api/v2',
      productionUrl: 'https://backend.payhero.co.ke/api/v2',
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

    // Try to make a simple API call to verify credentials
    try {
      const response = await axios.get(`${PAYHERO_API}/transaction-status`, {
        auth: {
          username: credentials.username,
          password: credentials.password,
        },
        params: { reference: 'test' },
        timeout: 10000,
      });

      // If we get a response (even an error), credentials are likely valid
      return { valid: true, errors: [], warnings: validation.warnings };
    } catch (error) {
      // 404 or other errors might still mean credentials are valid
      // Only fail on authentication errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        return { valid: false, errors: ['Authentication failed'], warnings: validation.warnings };
      }
      // Assume valid for other errors
      return { valid: true, errors: [], warnings: validation.warnings };
    }
  }

  /**
   * Check if PayHero is configured for an operator
   * @param {Object} operator - Operator object with encrypted credentials
   * @returns {boolean}
   */
  isConfigured(operator) {
    return Boolean(
      operator?.payheroUsernameCiphertext &&
      operator?.payheroPasswordCiphertext &&
      operator?.payheroChannelId
    );
  }

  /**
   * Get decrypted credentials from operator
   * @param {Object} operator - Operator object with encrypted credentials
   * @returns {Object}
   */
  getCredentials(operator) {
    if (!this.isConfigured(operator)) {
      throw new Error('PayHero is not configured for this operator');
    }

    return {
      username: decryptCredential(operator.payheroUsernameCiphertext),
      password: decryptCredential(operator.payheroPasswordCiphertext),
      channelId: operator.payheroChannelId,
    };
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

    const amountValidation = validateAmount(amount, { min: 10, max: 150000 });
    if (!amountValidation.valid) {
      return {
        success: false,
        errorMessage: amountValidation.error,
      };
    }

    const auth = {
      username: operatorConfig.username,
      password: operatorConfig.password,
    };

    const payload = {
      amount,
      phone_number: phoneValidation.normalized,
      channel_id: operatorConfig.channelId,
      provider: 'm-pesa',
      external_reference: transactionId,
      callback_url: callbackUrl,
    };

    try {
      const response = await axios.post(
        `${PAYHERO_API}/payments`,
        payload,
        {
          auth,
          timeout: 20000,
        }
      );

      const data = response.data?.data || response.data || {};
      const reference = data.reference || data.Reference || data.transaction_reference;
      const checkoutId = data.checkout_request_id || data.CheckoutRequestID || data.checkoutRequestId || null;

      if (response.data?.success === false || !reference) {
        logger.error('PayHero payment initiation failed', { response: response.data });
        return {
          success: false,
          errorMessage: 'PayHero did not return a transaction reference',
          raw: response.data,
        };
      }

      return {
        success: true,
        providerReference: String(reference),
        checkoutId: checkoutId ? String(checkoutId) : null,
        status: 'pending',
        raw: data,
      };
    } catch (error) {
      logger.error('PayHero payment initiation error', { 
        error: error.message,
        response: error.response?.data 
      });
      return {
        success: false,
        errorMessage: error.response?.data?.message || error.message,
        raw: error.response?.data,
      };
    }
  }

  /**
   * Verify webhook callback signature
   * PayHero does not use HMAC signatures, so we validate the structure
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {Object} headers - HTTP headers from callback
   * @param {Object} body - Callback request body
   * @returns {Promise<CallbackVerificationResult>}
   */
  async verifyCallback(operatorConfig, headers, body) {
    const callback = body?.response || body || {};
    const transactionId = String(callback.ExternalReference || callback.external_reference || '');
    const checkoutId = callback.CheckoutRequestID || callback.checkout_request_id || null;
    const callbackStatus = String(callback.Status || callback.status || '').toUpperCase();

    if (!transactionId) {
      return {
        valid: false,
        errorMessage: 'Missing external transaction reference',
      };
    }

    const amount = Number(callback.Amount ?? callback.amount);

    return {
      valid: true,
      transactionId,
      providerReference: checkoutId || transactionId,
      status: ['SUCCESS', 'COMPLETED'].includes(callbackStatus) ? 'completed' : 'failed',
      amount,
      receipt: callback.MpesaReceiptNumber || callback.mpesa_receipt_number || null,
    };
  }

  /**
   * Check transaction status
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {string} providerReference - Provider's transaction reference
   * @returns {Promise<TransactionStatusResult>}
   */
  async checkStatus(operatorConfig, providerReference) {
    const auth = {
      username: operatorConfig.username,
      password: operatorConfig.password,
    };

    try {
      const response = await axios.get(`${PAYHERO_API}/transaction-status`, {
        auth,
        params: { reference: providerReference },
        timeout: 15000,
      });

      const data = response.data?.data || response.data || {};

      return {
        success: true,
        status: this.normalizeStatus(data.status || data.Status),
        amount: data.amount || data.Amount,
        receipt: data.provider_reference || data.receipt || null,
        raw: data,
      };
    } catch (error) {
      logger.error('PayHero status check error', { 
        error: error.message,
        response: error.response?.data 
      });
      return {
        success: false,
        status: 'unknown',
        errorMessage: error.response?.data?.message || error.message,
        raw: error.response?.data,
      };
    }
  }

  /**
   * Normalize provider status to internal status
   * @param {string} providerStatus - Provider's raw status
   * @returns {string} - Normalized status
   */
  normalizeStatus(providerStatus) {
    const status = String(providerStatus).toUpperCase();
    
    if (status === 'SUCCESS' || status === 'COMPLETED') {
      return 'completed';
    }
    if (status === 'FAILED' || status === 'CANCELLED') {
      return 'failed';
    }
    if (status === 'PENDING' || status === 'PROCESSING') {
      return 'pending';
    }
    
    return 'unknown';
  }

  /**
   * Process a refund (not supported by PayHero)
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
      errorMessage: 'Refunds are not supported by PayHero. Contact PayHero support directly.',
    };
  }
}

module.exports = PayHeroAdapter;
