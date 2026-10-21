const jwt = require("jsonwebtoken");
const prisma = require("../config/prismaClient");

function signingSecret() {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("Operator authentication requires JWT_SECRET or SESSION_SECRET.");
  return secret;
}

function issueOperatorToken(operator) {
  return jwt.sign(
    { role: "operator_admin", operatorId: operator.id, slug: operator.slug },
    signingSecret(),
    { expiresIn: "12h" },
  );
}

function requireOperatorAuth(req, res, next) {
  const authorization = req.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ success: false, error: "Sign in to manage this operator account." });

  try {
    const decoded = jwt.verify(token, signingSecret());
    if (decoded.role !== "operator_admin" || !Number.isInteger(Number(decoded.operatorId))) {
      return res.status(403).json({ success: false, error: "Operator access is required." });
    }
    if (req.operator && req.operator.id !== Number(decoded.operatorId)) {
      return res.status(403).json({ success: false, error: "This account does not belong to this operator subdomain." });
    }
    req.operatorAccount = decoded;
    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, error: "Your operator session is invalid or expired." });
  }
}

async function getAuthenticatedOperator(req) {
  const operator = await prisma.operator.findUnique({
    where: { id: Number(req.operatorAccount.operatorId) },
  });
  if (!operator || operator.status !== "active") return null;
  if (req.operator && req.operator.id !== operator.id) return null;
  return operator;
}

module.exports = { getAuthenticatedOperator, issueOperatorToken, requireOperatorAuth, signingSecret };
