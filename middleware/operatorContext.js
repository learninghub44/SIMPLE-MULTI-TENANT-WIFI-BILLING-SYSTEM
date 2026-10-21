const prisma = require("../config/prismaClient");
const { getOperatorHostContext } = require("../services/operatorHost");

async function operatorContext(req, res, next) {
  req.operator = null;
  if (req.path.startsWith("/_next/") || /\.[a-z0-9]{2,8}$/i.test(req.path)) {
    return next();
  }
  let hostContext = getOperatorHostContext(req.get("host"));
  if (hostContext.kind === "platform" && req.get("origin")) {
    try {
      const originHost = new URL(req.get("origin")).host;
      const originContext = getOperatorHostContext(originHost);
      if (originContext.kind === "operator" || originContext.kind === "invalid") {
        hostContext = originContext;
      }
    } catch (_error) {
      return res.status(400).json({ success: false, error: "Invalid request origin." });
    }
  }
  req.hostContext = hostContext;

  if (hostContext.kind === "invalid") {
    return res.status(404).json({ success: false, error: "Invalid operator subdomain." });
  }
  if (hostContext.kind !== "operator") return next();

  try {
    const operator = await prisma.operator.findUnique({
      where: { slug: hostContext.slug },
      select: { id: true, slug: true, businessName: true, status: true },
    });

    if (!operator || operator.status !== "active") {
      return res.status(404).json({ success: false, error: "Operator not found." });
    }

    req.operator = operator;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = operatorContext;
