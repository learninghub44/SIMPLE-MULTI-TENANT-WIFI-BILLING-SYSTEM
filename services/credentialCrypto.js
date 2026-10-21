const { createCipheriv, createDecipheriv, hkdfSync, randomBytes } = require("node:crypto");

function getEncryptionKey() {
  const masterSecret =
    process.env.PAYMENT_CREDENTIALS_KEY ||
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET;

  if (!masterSecret) {
    throw new Error("Set PAYMENT_CREDENTIALS_KEY, SESSION_SECRET, or JWT_SECRET before saving operator credentials.");
  }

  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(masterSecret, "utf8"),
      Buffer.from("wifi-billing-operator-credentials", "utf8"),
      Buffer.from("aes-256-gcm:v1", "utf8"),
      32,
    ),
  );
}

function encryptCredential(value) {
  if (typeof value !== "string" || value.length === 0) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decryptCredential(encryptedValue) {
  if (!encryptedValue) return null;

  const [version, ivText, tagText, ciphertextText] = String(encryptedValue).split(".");
  if (version !== "v1" || !ivText || !tagText || !ciphertextText) {
    throw new Error("Stored operator credential has an unsupported format.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

module.exports = { decryptCredential, encryptCredential };
