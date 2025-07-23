import { Server, Socket } from "socket.io";
import { supabaseAdmin } from "../config/supabase";
import { MatchmakingService } from "../services/matchmaking";
import { CallService } from "../services/call";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

export const setupSocketHandlers = (io: Server): void => {
  const matchmakingService = new MatchmakingService();
  const callService = new CallService();

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth["token"];

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      // Verify token with Supabase
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        return next(new Error("Invalid token"));
      }

      socket.userId = user.id;
      socket.userEmail = user.email || "";

      // Update user as active
      await supabaseAdmin
        .from("users")
        .update({
          is_active: true,
          last_active_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.userId} connected`);

    // Join waiting room
    socket.on("user:join", async () => {
      if (!socket.userId) return;

      await matchmakingService.addToWaitingRoom(socket.userId, socket.id);
      socket.join("waiting-room");

      // Try to find a match immediately
      const match = await matchmakingService.findMatch(socket.userId);
      if (match) {
        const otherSocket = io.sockets.sockets.get(match.socketId);
        if (otherSocket) {
          // Notify both users of the match
          socket.emit("match:found", {
            partnerId: match.userId,
            partnerSocketId: match.socketId,
          });
          otherSocket.emit("match:found", {
            partnerId: socket.userId,
            partnerSocketId: socket.id,
          });

          // Start call session
          callService.startCall(socket.userId, match.userId);
        }
      }
    });

    // WebRTC signaling events
    socket.on(
      "webrtc:offer",
      (data: { targetSocketId: string; offer: any }) => {
        const targetSocket = io.sockets.sockets.get(data.targetSocketId);
        if (targetSocket) {
          targetSocket.emit("webrtc:offer", {
            offer: data.offer,
            fromSocketId: socket.id,
          });
        }
      }
    );

    socket.on(
      "webrtc:answer",
      (data: { targetSocketId: string; answer: any }) => {
        const targetSocket = io.sockets.sockets.get(data.targetSocketId);
        if (targetSocket) {
          targetSocket.emit("webrtc:answer", {
            answer: data.answer,
            fromSocketId: socket.id,
          });
        }
      }
    );

    socket.on(
      "webrtc:ice-candidate",
      (data: { targetSocketId: string; candidate: any }) => {
        const targetSocket = io.sockets.sockets.get(data.targetSocketId);
        if (targetSocket) {
          targetSocket.emit("webrtc:ice-candidate", {
            candidate: data.candidate,
            fromSocketId: socket.id,
          });
        }
      }
    );

    // Call interaction events
    socket.on("call:like", async (data: { partnerId: string }) => {
      if (!socket.userId) return;

      const result = await callService.handleLike(
        socket.userId,
        data.partnerId
      );

      if (result.mutual) {
        // Both users liked each other - share contact info
        const contactInfo = await callService.shareContactInfo(
          socket.userId,
          data.partnerId
        );

        socket.emit("contact:shared", contactInfo);
        const partnerSocket = io.sockets.sockets.get(data.partnerId);
        if (partnerSocket) {
          partnerSocket.emit("contact:shared", contactInfo);
        }
      }
    });

    socket.on("call:dislike", async (data: { partnerId: string }) => {
      if (!socket.userId) return;

      await callService.handleDislike(socket.userId, data.partnerId);

      // End call for both users
      socket.emit("call:end", { reason: "disliked" });
      const partnerSocket = io.sockets.sockets.get(data.partnerId);
      if (partnerSocket) {
        partnerSocket.emit("call:end", { reason: "disliked" });
      }
    });

    socket.on("call:end", async (data: { partnerId: string }) => {
      if (!socket.userId) return;

      await callService.endCall(socket.userId, data.partnerId);

      // Notify partner
      const partnerSocket = io.sockets.sockets.get(data.partnerId);
      if (partnerSocket) {
        partnerSocket.emit("call:end", { reason: "partner_ended" });
      }
    });

    // Disconnect handling
    socket.on("disconnect", async () => {
      if (socket.userId) {
        console.log(`User ${socket.userId} disconnected`);

        // Remove from waiting room
        await matchmakingService.removeFromWaitingRoom(socket.userId);

        // Update user as inactive
        await supabaseAdmin
          .from("users")
          .update({
            is_active: false,
            last_active_at: new Date().toISOString(),
          })
          .eq("id", socket.userId);
      }
    });
  });
};
