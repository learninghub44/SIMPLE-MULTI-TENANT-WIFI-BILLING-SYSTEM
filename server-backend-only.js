require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const http = require("http");
const socketIo = require("socket.io");
const prisma = require("./config/prismaClient");
const logger = require("./src/logger");

// Initialize provider registries
try {
  const { paymentRegistry } = require("./src/integrations/payments/index");
  const { smsRegistry } = require("./src/integrations/sms/index");
  
  global.paymentRegistry = paymentRegistry;
  global.smsRegistry = smsRegistry;
  
  logger.info("Provider registries initialized successfully");
  logger.info("Payment providers:", Object.keys(paymentRegistry.providers));
  logger.info("SMS providers:", Object.keys(smsRegistry.providers));
} catch (error) {
  logger.error("Failed to initialize provider registries:", error);
}

// Routes
const mpesaRoutes = require("./routes/mpesaRoutes");
const mpesaCallback = require("./routes/mpesaCallback");
const payheroCallback = require("./routes/payheroCallback");
const operatorRoutes = require("./routes/operatorRoutes");
const operatorContext = require("./middleware/operatorContext");
const supportRoutes = require("./routes/support");
const authRoutes = require("./routes/auth");
const loanRoutes = require("./routes/loanRoutes");
const adminRoutes = require("./routes/admin");
const transactionRoutes = require("./routes/transactions");

const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(operatorContext);

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token)
    return res.status(401).json({ error: "Access denied. No token provided." });
  try {
    const tokenValue = token.replace("Bearer ", "");
    const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);
    if (decoded.exp && Date.now() >= decoded.exp * 1000)
      return res.status(401).json({ error: "Token has expired." });
    if (decoded.role !== "admin")
      return res.status(403).json({ error: "Access denied. Admins only." });
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token." });
  }
};

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/operators", operatorRoutes);
app.use("/loans", loanRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", mpesaRoutes);
app.use("/api", mpesaCallback);
app.use("/api", payheroCallback);
app.use("/api/support", supportRoutes);
app.use("/api/transactions", transactionRoutes);

// Device info route
app.get("/api/device/info", async (req, res) => {
  try {
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] ||
                     req.connection.remoteAddress ||
                     req.socket.remoteAddress ||
                     "127.0.0.1";
    const ipAddress = clientIP.replace(/^::ffff:/, '');
    
    logger.info(`Device info request from IP: ${ipAddress}`);
    
    if (req.operator) {
      const requestedMac = String(req.query.mac || req.query.macAddress || "").trim();
      if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(requestedMac)) {
        return res.json({
          success: true,
          data: { macAddress: requestedMac.toUpperCase(), ipAddress, deviceId: "HOTSPOT_DEVICE" },
        });
      }
      const operator = await prisma.operator.findUnique({ where: { id: req.operator.id } });
      const { getOperatorDeviceInfo } = require("./services/operatorRouter");
      const operatorDevice = operator ? await getOperatorDeviceInfo(operator, ipAddress) : null;
      if (operatorDevice?.success) return res.json(operatorDevice);
      return res.status(503).json({
        success: false,
        error: "Device MAC was not supplied by the hotspot portal.",
      });
    }
    
    res.json({
      success: true,
      data: {
        macAddress: "00:11:22:33:44:55",
        ipAddress: ipAddress,
        deviceId: "DEV001"
      }
    });
  } catch (error) {
    logger.error("Error retrieving device info:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve device information"
    });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ 
    message: "WiFi Billing System API is running (Backend Only)", 
    status: "OK",
    providers: {
      payment: global.paymentRegistry ? Object.keys(global.paymentRegistry.providers) : [],
      sms: global.smsRegistry ? Object.keys(global.smsRegistry.providers) : []
    }
  });
});

app.get("/welcome", (req, res) => {
  logger.info(`Request received: ${req.method} ${req.path}`);
  res.json({ message: "Welcome to the WiFi Billing System API!" });
});

// Create HTTP server for Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('User connected:', socket.id);
  socket.on('join_loan_room', (userId) => {
    socket.join(`loan_${userId}`);
    logger.info(`User ${userId} joined loan room`);
  });
  socket.on('leave_loan_room', (userId) => {
    socket.leave(`loan_${userId}`);
    logger.info(`User ${userId} left loan room`);
  });
  socket.on('join_admin_loans', () => {
    socket.join('admin_loans');
    logger.info('Admin joined loan monitoring room');
  });
  socket.on('join_support', (phone) => {
    socket.join(`support_${phone}`);
    logger.info(`User with phone ${phone} joined support room`);
  });
  socket.on('disconnect', () => {
    logger.info('User disconnected:', socket.id);
  });
});

global.io = io;
global.emitLoanEvent = (event, data, userId = null) => {
  if (userId) io.to(`loan_${userId}`).emit(event, data);
  io.to('admin_loans').emit(event, data);
};
global.emitSupportEvent = (event, data, phone = null) => {
  if (phone) io.to(`support_${phone}`).emit(event, data);
};

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on http://0.0.0.0:${PORT}`);
  logger.info(`WebSocket server ready for real-time updates`);
  logger.info(`Backend-only mode (Next.js frontend disabled)`);
});
