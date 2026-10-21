const prisma = require("../config/prismaClient");
const { whitelistMAC } = require("../config/mikrotik");
const { whitelistOperatorMac } = require("./operatorRouter");

const HOURS_BY_AMOUNT = { 10: 1, 15: 4, 20: 12, 30: 24 };

async function completeWifiPayment(payment, receipt, providerReference) {
  const hours = HOURS_BY_AMOUNT[payment.amount];
  if (!hours) throw new Error("Payment amount is not a supported Wi-Fi package.");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "completed",
      providerReceipt: receipt || null,
      mpesaRef: receipt || providerReference || payment.mpesaRef,
      expiresAt,
    },
  });

  const latest = await prisma.payment.findUnique({ where: { id: payment.id } });
  if (!latest || latest.accessStatus === "granted" || latest.accessStatus === "provisioning") {
    return { accessStatus: latest?.accessStatus || "pending", expiresAt };
  }

  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, accessStatus: { in: ["pending", "failed"] } },
    data: { accessStatus: "provisioning" },
  });
  if (claimed.count !== 1) {
    const current = await prisma.payment.findUnique({ where: { id: payment.id }, select: { accessStatus: true } });
    return { accessStatus: current?.accessStatus || "pending", expiresAt };
  }

  let provisionResult;
  if (payment.operatorId) {
    const operator = await prisma.operator.findUnique({ where: { id: payment.operatorId } });
    provisionResult = operator
      ? await whitelistOperatorMac(operator, payment.macAddress, `${hours}h`)
      : { success: false, message: "Operator router configuration is unavailable." };
  } else {
    provisionResult = await whitelistMAC(payment.macAddress, `${hours}h`);
  }

  const accessStatus = provisionResult.success ? "granted" : "failed";
  await prisma.payment.update({
    where: { id: payment.id },
    data: { accessStatus },
  });
  return { accessStatus, expiresAt, message: provisionResult.message };
}

module.exports = { completeWifiPayment, HOURS_BY_AMOUNT };
