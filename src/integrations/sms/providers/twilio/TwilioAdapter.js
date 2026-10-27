/**
 * Twilio SMS Adapter
 * 
 * Implements the SmsAdapter contract for Twilio SMS gateway.
 * Global SMS provider with extensive international coverage.
 */

const axios = require('axios');
const SmsAdapter = require('../../contracts/SmsAdapter');
const { validatePhone, validateCredentials } = require('../../../shared/validation/Validator');
const logger = require('../../../../../src/logger');

const TWILIO_API = 'https://api.twilio.com';

class TwilioAdapter extends SmsAdapter {
  /**
   * Get provider metadata
   * @returns {SmsProviderMetadata}
   */
  getMetadata() {
    return {
      providerId: 'twilio',
      displayName: 'Twilio',
      supportedCountries: ['KE', 'UG', 'TZ', 'NG', 'US', 'GB', 'CA', 'AU', 'IN', 'ZA', 'ZW', 'ZM', 'MW', 'BW', 'NA', 'TZ', 'RW', 'BI', 'ET', 'ML', 'SN', 'GH', 'CI', 'CM', 'CD'], // Extensive coverage
      capabilities: {
        sendSms: true,
        deliveryReports: true,
        senderId: true,
        bulkSend: true,
        balanceCheck: true,
        scheduledSend: false,
        unicode: true,
        flashSms: false,
      },
      requiredCredentials: [
        {
          key: 'accountSid',
          displayName: 'Account SID',
          type: 'string',
          required: true,
          sensitive: true,
          placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          description: 'From Twilio console',
        },
        {
          key: 'authToken',
          displayName: 'Auth Token',
          type: 'string',
          required: true,
          sensitive: true,
          placeholder: 'your_auth_token',
          description: 'From Twilio console',
        },
        {
          key: 'messagingServiceSid',
          displayName: 'Messaging Service SID',
          type: 'string',
          required: false,
          sensitive: false,
          placeholder: 'MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          description: 'Optional: Use a messaging service instead of sender ID',
        },
      ],
      documentationUrl: 'https://www.twilio.com/docs/sms',
      sandboxUrl: 'https://api.twilio.com',
      productionUrl: 'https://api.twilio.com',
      pricing: {
        perSms: '0.05',
        currency: 'USD',
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

    // Validate phone number - Twilio requires E.164 format
    const phoneValidation = validatePhone(to, 'KE');
    if (!phoneValidation.valid) {
      return {
        success: false,
        errorMessage: phoneValidation.error,
      };
    }

    // Format to E.164 with + prefix
    const formattedPhone = '+' + phoneValidation.normalized;

    // Truncate message if too long (Twilio supports up to 1600 chars)
    const truncatedMessage = this.truncateMessage(smsContent, 1600);

    // Prepare request
    const payload = new URLSearchParams();
    payload.append('To', formattedPhone);
    payload.append('Body', truncatedMessage);

    if (operatorConfig.messagingServiceSid) {
      payload.append('MessagingServiceSid', operatorConfig.messagingServiceSid);
    } else if (senderId) {
      payload.append('From', senderId);
    } else {
      return {
        success: false,
        errorMessage: 'Either messagingServiceSid or senderId is required',
      };
    }

    if (idempotencyKey) {
      // Twilio doesn't have native idempotency, but we can add it as a tag
      payload.append('StatusCallback', `${process.env.PUBLIC_API_BASE_URL}/api/sms/twilio/delivery?idempotencyKey=${idempotencyKey}`);
    }

    try {
      const response = await axios.post(
        `${TWILIO_API}/2010-04-01/Accounts/${operatorConfig.accountSid}/Messages.json`,
        payload,
        {
          auth: {
            username: operatorConfig.accountSid,
            password: operatorConfig.authToken,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        }
      );

      const data = response.data;

      if (data.sid) {
        return {
          success: true,
          messageId: data.sid,
          status: data.status.toLowerCase(),
          cost: null, // Cost not available immediately
          currency: 'USD',
          raw: data,
        };
      }

      logger.error('Twilio SMS send failed', { response: data });
      return {
        success: false,
        errorMessage: data.message || 'Unknown error from Twilio',
        errorCode: data.code,
        raw: data,
      };
    } catch (error) {
      logger.error('Twilio SMS send error', { 
        error: error.message,
        response: error.response?.data 
      });
      return {
        success: false,
        errorMessage: error.response?.data?.message || error.message,
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
    // Twilio sends delivery reports as POST with form data
    const messageId = body.MessageSid || body.Sid;
    const status = body.MessageStatus || body.Status;
    const timestamp = body.Timestamp;

    if (!messageId) {
      throw new Error('Missing message ID in delivery report');
    }

    // Normalize status
    let normalizedStatus = 'unknown';
    if (status) {
      const statusLower = String(status).toLowerCase();
      if (statusLower === 'delivered') {
        normalizedStatus = 'delivered';
      } else if (statusLower === 'failed' || statusLower === 'undelivered') {
        normalizedStatus = 'failed';
      } else if (statusLower === 'queued' || statusLower === 'sending' || statusLower === 'sent') {
        normalizedStatus = 'pending';
      }
    }

    return {
      messageId,
      status: normalizedStatus,
      deliveredAt: timestamp ? new Date(timestamp) : null,
      failureReason: body.ErrorCode ? `Error code: ${body.ErrorCode}` : null,
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
        `${TWILIO_API}/2010-04-01/Accounts/${operatorConfig.accountSid}/Balance.json`,
        {
          auth: {
            username: operatorConfig.accountSid,
            password: operatorConfig.authToken,
          },
          timeout: 10000,
        }
      );

      const data = response.data;

      if (data.account_sid) {
        return {
          success: true,
          balance: parseFloat(data.balance),
          currency: data.currency || 'USD',
          raw: data,
        };
      }

      return {
        success: false,
        errorMessage: 'Invalid response from Twilio',
        raw: data,
      };
    } catch (error) {
      logger.error('Twilio balance check error', { 
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
}

module.exports = TwilioAdapter;
