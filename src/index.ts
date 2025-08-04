import express, { Request, Response } from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { initializeSupabase } from "./config/supabase";
import { errorHandler } from "./middleware/errorHandler";
import { authMiddleware } from "./middleware/auth";
import { WebSocketManager } from "./websocket/WebSocketManager";
import { MatchmakingService } from "./services/matchmaking";
import { SignalingServer } from "./SignalingServer";

// Load environment variables
dotenv.config();

console.log("🚀 Starting Blink Service...");

const app = express();
const server = createServer(app);
const matchmakingService = new MatchmakingService();

console.log("🔧 Initializing Supabase...");
// Initialize Supabase
initializeSupabase();
console.log("✅ Supabase initialized");

console.log("🔧 Setting up middleware...");
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
console.log("✅ Middleware setup complete");

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Debug endpoint to check waiting room status
app.get("/debug/waiting-room", (_req: Request, res: Response) => {
  matchmakingService.getWaitingRoomStats().then((stats) => {
    res.json({
      waitingRoomSize: stats.count,
      timestamp: new Date().toISOString(),
      message: "Use this endpoint to check waiting room status",
    });
  });
});

// WebSocket stats endpoint
app.get("/debug/websocket-stats", (_req: Request, res: Response) => {
  if (wsManager) {
    const stats = wsManager.getStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
      message: "WebSocket connection statistics",
    });
  } else {
    res.status(503).json({ error: "WebSocket manager not initialized" });
  }
});

// Protected routes
app.use("/api", authMiddleware);
app.get("/api/webrtc-config", (_req: Request, res: Response) => {
  res.json({
    iceServers: [
      { urls: process.env["STUN_SERVER_1"] || "stun:stun.l.google.com:19302" },
      { urls: process.env["STUN_SERVER_2"] || "stun:stun1.l.google.com:19302" },
    ],
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env["PORT"] || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Blink Service running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🐛 Debug endpoints:`);
  console.log(`   - Waiting room: http://localhost:${PORT}/debug/waiting-room`);
  console.log(
    `   - WebSocket stats: http://localhost:${PORT}/debug/websocket-stats`
  );
  console.log(
    `🌐 CORS origins: ${process.env["CORS_ORIGIN"] || "http://localhost:3000"}`
  );
});

console.log("🔧 Setting up WebSocket Manager...");
// Initialize WebSocket Manager
let wsManager: WebSocketManager;
try {
  wsManager = new WebSocketManager(server);
  console.log("✅ WebSocket Manager setup complete");
  console.log("🤖 Auto-matching service started");
} catch (error) {
  console.error("💥 Failed to initialize WebSocket Manager:", error);
  process.exit(1);
}

console.log("🔧 Setting up Signaling Server...");
try {
  new SignalingServer(server);
  console.log("✅ Signaling Server setup complete");
} catch (error) {
  console.error("💥 Failed to initialize Signaling Server:", error);
  process.exit(1);
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully...");
  gracefulShutdown();
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully...");
  gracefulShutdown();
});

async function gracefulShutdown(): Promise<void> {
  try {
    console.log("🔄 Starting graceful shutdown...");

    // Close WebSocket manager
    if (wsManager) {
      wsManager.shutdown();
    }

    // Close HTTP server
    server.close(() => {
      console.log("✅ HTTP server closed");
    });

    console.log("✅ Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("💥 Error during shutdown:", error);
    process.exit(1);
  }
}
