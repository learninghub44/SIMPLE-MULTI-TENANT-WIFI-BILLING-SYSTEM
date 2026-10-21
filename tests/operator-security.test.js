const test = require("node:test");
const assert = require("node:assert/strict");
const {
  decryptCredential,
  encryptCredential,
} = require("../services/credentialCrypto");
const {
  getOperatorHostContext,
  validateOperatorSlug,
} = require("../services/operatorHost");
const {
  isPrivateOrReservedIpv4,
  resolvePublicRouterIpv4,
} = require("../services/safeRouterHost");

test("operator hosts resolve only from the configured base domain", () => {
  assert.deepEqual(getOperatorHostContext("shop.example.com:443", "example.com", "production"), {
    kind: "operator",
    slug: "shop",
  });
  assert.deepEqual(getOperatorHostContext("example.com", "example.com", "production"), { kind: "platform" });
  assert.deepEqual(getOperatorHostContext("nested.shop.example.com", "example.com", "production"), { kind: "invalid" });
  assert.deepEqual(getOperatorHostContext("shop.localhost:5000", "", "development"), {
    kind: "operator",
    slug: "shop",
  });
});

test("operator subdomains reject reserved names and invalid characters", () => {
  assert.equal(validateOperatorSlug("my-hotspot").valid, true);
  assert.equal(validateOperatorSlug("api").valid, false);
  assert.equal(validateOperatorSlug("bad_slug").valid, false);
  assert.equal(validateOperatorSlug("x").valid, false);
});

test("credential encryption round-trips and does not store plaintext", () => {
  process.env.PAYMENT_CREDENTIALS_KEY = "test-key-for-operator-credential-encryption";
  const encrypted = encryptCredential("private-value");
  assert.notEqual(encrypted, "private-value");
  assert.equal(decryptCredential(encrypted), "private-value");
});

test("router target validation rejects private networks and permits a public IPv4 literal", async () => {
  for (const address of ["10.0.0.1", "127.0.0.1", "192.168.1.1", "169.254.10.2", "100.64.0.1"]) {
    assert.equal(isPrivateOrReservedIpv4(address), true, `${address} should be rejected`);
  }
  assert.equal(isPrivateOrReservedIpv4("8.8.8.8"), false);
  await assert.rejects(() => resolvePublicRouterIpv4("192.168.1.1"), /public IPv4/);
  assert.equal(await resolvePublicRouterIpv4("8.8.8.8"), "8.8.8.8");
});
