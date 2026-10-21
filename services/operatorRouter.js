const { RouterOSClient } = require("node-routeros");
const { decryptCredential } = require("./credentialCrypto");
const { resolvePublicRouterIpv4 } = require("./safeRouterHost");

function routerSettingsConfigured(operator) {
  return Boolean(
    operator?.mikrotikHost &&
    operator?.mikrotikUsernameCiphertext &&
    operator?.mikrotikPasswordCiphertext &&
    (operator?.mikrotikPort || 8728) === 8728
  );
}

async function createOperatorRouterClient(operator) {
  if (!routerSettingsConfigured(operator)) {
    throw new Error("This operator has not configured a MikroTik router.");
  }
  const host = await resolvePublicRouterIpv4(operator.mikrotikHost);
  const username = decryptCredential(operator.mikrotikUsernameCiphertext);
  const password = decryptCredential(operator.mikrotikPasswordCiphertext);
  if (!username || !password) throw new Error("MikroTik credentials are incomplete.");

  return new RouterOSClient({
    host,
    user: username,
    password,
    port: 8728,
    timeout: 7000,
  });
}

async function testOperatorRouter(operator) {
  const client = await createOperatorRouterClient(operator);
  try {
    await client.connect();
    return { success: true, message: "MikroTik connection verified." };
  } finally {
    try {
      await client.close();
    } catch (_error) {
      // The socket may not have opened if connect failed.
    }
  }
}

async function whitelistOperatorMac(operator, macAddress, timeLabel) {
  if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(String(macAddress || ""))) {
    return { success: false, message: "A valid device MAC address is required." };
  }

  let client;
  try {
    client = await createOperatorRouterClient(operator);
    await client.connect();
    await client.write(["/ip/hotspot/ip-binding/add"], {
      "mac-address": macAddress.toUpperCase(),
      type: "bypassed",
      comment: `WiFi ${timeLabel} payment`,
    });
    return { success: true, message: `Whitelisted ${macAddress} for ${timeLabel}.` };
  } catch (_error) {
    return { success: false, message: "MikroTik access could not be provisioned. Check the saved router settings." };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (_error) {
        // Preserve the provisioning result if the socket was already closed.
      }
    }
  }
}

async function getOperatorDeviceInfo(operator, ipAddress) {
  let client;
  try {
    client = await createOperatorRouterClient(operator);
    await client.connect();
    const active = await client.write(["/ip/hotspot/active/print"]);
    const device = (active || []).find((entry) => entry.address === ipAddress);
    if (!device) return { success: false, error: "Device not found in the operator's active hotspot sessions." };
    return {
      success: true,
      data: {
        macAddress: device["mac-address"],
        ipAddress: device.address,
        deviceId: device.user || `DEV_${device[".id"]}`,
      },
    };
  } catch (_error) {
    return { success: false, error: "Device details are not available from this operator's router." };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (_error) {
        // No action required.
      }
    }
  }
}

module.exports = {
  getOperatorDeviceInfo,
  routerSettingsConfigured,
  testOperatorRouter,
  whitelistOperatorMac,
};
