const express = require("express");
const router = express.Router();
const { execFile } = require("child_process");

// Input validation and sanitization
const validateIP = (ip) => {
  if (!ip || typeof ip !== 'string') return false;
  
  // Basic IP validation regex
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
};

const getMacAddress = (ip) => {
  return new Promise((resolve) => {
    if (!ip || !validateIP(ip)) {
      return resolve(null);
    }

    const platform = process.platform;
    const args = platform === "win32" ? ["-a"] : ["-an"];

    // Pass fixed arguments directly; never interpolate request data into a shell command.
    execFile("arp", args, { timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) {
        return resolve("MAC_NOT_FOUND");
      }

      const matchingLine = stdout.split(/\r?\n/).find((line) => {
        const trimmedLine = line.trim();
        return platform === "win32"
          ? trimmedLine.split(/\s+/)[0] === ip
          : trimmedLine.includes(`(${ip})`);
      });
      const macRegex = /([a-fA-F0-9]{2}[:-]){5}[a-fA-F0-9]{2}/;
      const macMatch = matchingLine?.match(macRegex);
      resolve(macMatch ? macMatch[0].replace(/-/g, ":").toUpperCase() : "MAC_NOT_FOUND");
    });
  });
};

router.get("/device/info", async (req, res) => {
  try {
    const forwardedFor = req.headers["x-forwarded-for"];
    const ipFromForwarded = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(",")[0];
    const ip = req.query.ip || ipFromForwarded || req.ip || req.connection?.remoteAddress;

    if (!ip || !validateIP(ip)) {
      return res.status(400).json({ 
        success: false, 
        error: "Valid IP address is required." 
      });
    }

    const macAddress = await getMacAddress(ip);
    return res.json({
      success: true,
      data: {
        macAddress,
        ipAddress: ip,
        deviceId: macAddress !== "MAC_NOT_FOUND" ? macAddress : ip,
      },
    });
  } catch (error) {
    console.error("/device/info error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;
