import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { initializeSupabase } from "./config/supabase";
import { setupSocketHandlers } from "./socket/handlers";
import { errorHandler } from "./middleware/errorHandler";
import { authMiddleware } from "./middleware/auth";

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env["CORS_ORIGIN"]?.split(",") || ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize Supabase
initializeSupabase();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env["CORS_ORIGIN"]?.split(",") || ["http://localhost:3000"],
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env["RATE_LIMIT_WINDOW_MS"] || "900000"),
  max: parseInt(process.env["RATE_LIMIT_MAX_REQUESTS"] || "100"),
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Protected routes
app.use("/api", authMiddleware);
app.get("/api/webrtc-config", (req, res) => {
  res.json({
    iceServers: [
      { urls: process.env["STUN_SERVER_1"] || "stun:stun.l.google.com:19302" },
      { urls: process.env["STUN_SERVER_2"] || "stun:stun1.l.google.com:19302" },
    ],
  });
});

// Error handling middleware
app.use(errorHandler);

// Setup Socket.IO handlers
setupSocketHandlers(io);

const PORT = process.env["PORT"] || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Blink Service running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export { app, io };
