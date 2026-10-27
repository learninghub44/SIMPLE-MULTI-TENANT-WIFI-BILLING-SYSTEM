/**
 * Africa's Talking SMS Adapter
 * 
 * Implements the SmsAdapter contract for Africa's Talking SMS gateway.
 * Priority SMS provider for Kenyan market.
 */

const axios = require('axios');
const SmsAdapter = require('../../contracts/SmsAdapter');
const { validatePhone, validateCredentials } = require('../../../shared/validation/Validator');
const logger = require('../../../../../src/logger');

const AFRICAS_TALKING_API = 'https://api.africastalking.com/version1';

class AfricaTalkingAdapter extends SmsAdapter {
  /**
   * Get provider metadata
   * @returns {SmsProviderMetadata}
   */
  getMetadata() {
    return {
      providerId: 'africas-talking',
      displayName: "Africa's Talking",
      supportedCountries: ['KE', 'UG', 'TZ', 'NG', 'RW', 'BI', 'ET', 'ML', 'SN', 'GH', 'CI', 'CM', 'CD'],
      capabilities: {
        sendSms: true,
        deliveryReports: true,
        senderId: true,
        bulkSend: true,
        balanceCheck: true,
        scheduledSend: true,
        unicode: true,
        flashSms: false,
      },
      requiredCredentials: [
        {
          key: 'username',
          displayName: 'Username',
          type: 'string',
          required: true,
          sensitive: false,
          placeholder: 'your_username',
          description: 'Africa\'s Talking account username',
        },
        {
          key: 'apiKey',
          displayName: 'API Key',
          type: 'string',
          required: true,
          sensitive: true,
          placeholder: 'your_api_key',
          description: 'From Africa\'s Talking dashboard',
        },
      ],
      documentationUrl: 'https://docs.africastalking.com/sms',
      sandboxUrl: 'https://api.sandbox.africastalking.com/version1',
      productionUrl: 'https://api.africastalking.com/version1',
      pricing: {
        perSms: '0.80',
        currency: 'KES',
      },
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

    // Try to check balance to verify credentials
    try {
      const balanceInfo = await this.checkBalance(credentials);
      if (balanceInfo.success) {
        return { valid: true, errors: [], warnings: validation.warnings };
      }
      return { valid: false, errors: [balanceInfo.errorMessage || 'Balance check failed'], warnings: validation.warnings };
    } catch (error) {
      return { valid: false, errors: [error.message], warnings: validation.warnings };
    }
  }

  /**
   * Send an SMS message
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {SmsMessage} message - SMS message to send
   * @returns {Promise<SmsSendResult>}
   */
  async sendSms(operatorConfig, message) {
    const { to, message: smsContent, senderId, idempotencyKey } = message;

    // Validate phone number
    const phoneValidation = validatePhone(to, 'KE');
    if (!phoneValidation.valid) {
      return {
        success: false,
        errorMessage: phoneValidation.error,
      };
    }

    // Truncate message if too long
    const truncatedMessage = this.truncateMessage(smsContent, 1600);

    // Prepare request
    const payload = new URLSearchParams();
    payload.append('username', operatorConfig.username);
    payload.append('to', phoneValidation.normalized);
    payload.append('message', truncatedMessage);

    if (senderId) {
      payload.append('from', senderId);
    }

    if (idempotencyKey) {
      payload.append('requestId', idempotencyKey);
    }

    try {
      const response = await axios.post(
        `${AFRICAS_TALKING_API}/messaging`,
        payload,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          timeout: 15000,
        }
      );

      const data = response.data;

      if (data.SMSMessageData?.Recipients) {
        const recipient = data.SMSMessageData.Recipients[0];
        return {
          success: true,
          messageId: recipient.messageId,
          status: recipient.status.toLowerCase(),
          cost: recipient.cost,
          currency: recipient.cost?.split(' ')[1] || 'KES',
          raw: data,
        };
      }

      logger.error('Africa\'s Talking SMS send failed', { response: data });
      return {
        success: false,
        errorMessage: data.errorMessage || 'Unknown error from Africa\'s Talking',
        raw: data,
      };
    } catch (error) {
      logger.error('Africa\'s Talking SMS send error', { 
        error: error.message,
        response: error.response?.data 
      });
      return {
        success: false,
        errorMessage: error.response?.data?.errorMessage || error.message,
        errorCode: error.response?.status,
        raw: error.response?.data,
      };
    }
  }

  /**
   * Process delivery report callback
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {Object} headers - HTTP headers from callback
   * @param {Object} body - Callback request body
   * @returns {Promise<DeliveryReport>}
   */
  async processDeliveryReport(operatorConfig, headers, body) {
    // Africa's Talking sends delivery reports as POST with form data
    const messageId = body.id || body.messageId;
    const status = body.status || body.deliveryStatus;
    const timestamp = body.timestamp || body.deliveryTimestamp;

    if (!messageId) {
      throw new Error('Missing message ID in delivery report');
    }

    // Normalize status
    let normalizedStatus = 'unknown';
    if (status) {
      const statusLower = String(status).toLowerCase();
      if (statusLower === 'success' || statusLower === 'delivered') {
        normalizedStatus = 'delivered';
      } else if (statusLower === 'failed' || statusLower === 'failure') {
        normalizedStatus = 'failed';
      } else if (statusLower === 'pending' || statusLower === 'buffered' || statusLower === 'submitted') {
        normalizedStatus = 'pending';
      }
    }

    return {
      messageId,
      status: normalizedStatus,
      deliveredAt: timestamp ? new Date(timestamp * 1000) : null,
      failureReason: body.failureReason || null,
      raw: body,
    };
  }

  /**
   * Check account balance
   * @param {Object} operatorConfig - Operator's provider configuration
   * @returns {Promise<BalanceInfo>}
   */
  async checkBalance(operatorConfig) {
    try {
      const response = await axios.get(
        `${AFRICAS_TALKING_API}/user`,
        {
          params: {
            username: operatorConfig.username,
          },
          headers: {
            'apiKey': operatorConfig.apiKey,
            'Accept': 'application/json',
          },
          timeout: 10000,
        }
      );

      const data = response.data;

      if (data.UserData) {
        return {
          success: true,
          balance: parseFloat(data.UserData.balance),
          currency: data.UserData.currency || 'KES',
          raw: data,
        };
      }

      return {
        success: false,
        errorMessage: 'Invalid response from Africa\'s Talking',
        raw: data,
      };
    } catch (error) {
      logger.error('Africa\'s Talking balance check error', { 
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
}

module.exports = AfricaTalkingAdapter;
