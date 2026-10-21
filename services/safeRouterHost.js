const dns = require("node:dns/promises");
const net = require("node:net");

function isPrivateOrReservedIpv4(address) {
  if (net.isIP(address) !== 4) return true;
  const [a, b, c] = address.split(".").map(Number);

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function validateRouterHostname(host) {
  const value = String(host || "").trim().toLowerCase();
  if (
    !value ||
    value.length > 253 ||
    value.includes("://") ||
    /[/\\\s:@?#]/.test(value) ||
    value === "localhost" ||
    value.endsWith(".localhost") ||
    value.endsWith(".local")
  ) {
    throw new Error("Enter a public IPv4 address or hostname for the MikroTik API.");
  }

  if (net.isIP(value) === 4) return value;
  if (net.isIP(value) !== 0) {
    throw new Error("MikroTik API host must resolve to a public IPv4 address.");
  }
  if (
    !value.includes(".") ||
    value.split(".").some((part) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))
  ) {
    throw new Error("Enter a valid public hostname or IPv4 address.");
  }
  return value;
}

async function resolvePublicRouterIpv4(host) {
  const value = validateRouterHostname(host);
  const addresses = net.isIP(value) === 4
    ? [{ address: value, family: 4 }]
    : await dns.lookup(value, { all: true, verbatim: true });

  if (!addresses.length || addresses.some((entry) => entry.family !== 4 || isPrivateOrReservedIpv4(entry.address))) {
    throw new Error("The MikroTik host must resolve only to public IPv4 addresses.");
  }
  return addresses[0].address;
}

module.exports = { isPrivateOrReservedIpv4, resolvePublicRouterIpv4, validateRouterHostname };
