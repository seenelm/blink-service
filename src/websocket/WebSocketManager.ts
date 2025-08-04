import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
// import { supabase } from "../config/supabase";
// import { MatchmakingService } from "../services/matchmaking";
// import { CallService } from "../services/call";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
}

export interface WebSocketConnection {
  ws: WebSocket;
  user: AuthenticatedUser;
  userId: string;
  socketId: string;
  connectedAt: Date;
  lastPing: Date;
  isAlive: boolean;
}

interface Message {
  type: string;
}

export class WebSocketManager {
  private wss: WebSocketServer;

  constructor(server: any) {
    this.wss = new WebSocketServer({
      server,
    });

    this.wss.on("connection", this.handleConnection.bind(this));
  }

  private handleConnection(socket: WebSocket, req: IncomingMessage) {
    console.log(
      `🟢 New WebSocket connection from ${req.socket?.remoteAddress}`
    );
    socket.on("message", (message: any) => {
      const data = JSON.parse(message.toString()) as Message;

      switch (data.type) {
        case "user:join":
          break;
      }
    });
  }
}

// export class WebSocketManager {
//   private wss: WebSocketServer;
//   private connections: Map<string, WebSocketConnection> = new Map();
//   private matchmakingService: MatchmakingService;
//   private callService: CallService;
//   private pingInterval!: NodeJS.Timeout;
//   private cleanupInterval!: NodeJS.Timeout;
//   private readonly PING_INTERVAL = 30000; // 30 seconds
//   private readonly CLEANUP_INTERVAL = 60000; // 1 minute
//   private readonly CONNECTION_TIMEOUT = 120000; // 2 minutes

//   constructor(server: any) {
//     this.wss = new WebSocketServer({
//       server,
//       perMessageDeflate: {
//         zlibDeflateOptions: {
//           chunkSize: 1024,
//           memLevel: 7,
//           level: 3,
//         },
//         zlibInflateOptions: {
//           chunkSize: 10 * 1024,
//         },
//         clientNoContextTakeover: true,
//         serverNoContextTakeover: true,
//         serverMaxWindowBits: 10,
//         concurrencyLimit: 10,
//         threshold: 1024,
//       },
//     });

//     this.matchmakingService = new MatchmakingService();
//     this.callService = new CallService();

//     this.setupEventHandlers();
//     // this.startHeartbeat();
//     // this.startCleanup();

//     console.log("🔧 WebSocket Manager initialized");
//   }

//   private setupEventHandlers(): void {
//     this.wss.on(
//       "connection",
//       async (ws: WebSocket, request: IncomingMessage) => {
//         try {
//           console.log(
//             `🟢 New WebSocket connection from ${request.socket.remoteAddress}`
//           );

//           // Authenticate the connection
//           // const user = await this.authenticateConnection(request);
//           // if (!user) {
//           //   console.log("❌ Authentication failed, closing connection");
//           //   ws.close(1008, "Authentication failed");
//           //   return;
//           // }

//           const socketId = this.generateSocketId();
//           const connection: WebSocketConnection = {
//             ws,
//             user,
//             userId: user.id,
//             socketId,
//             connectedAt: new Date(),
//             lastPing: new Date(),
//             isAlive: true,
//           };

//           this.connections.set(socketId, connection);
//           console.log(
//             `✅ User ${user.id} authenticated and connected (Socket: ${socketId})`
//           );

//           // Send welcome message
//           this.sendMessage(ws, {
//             type: "connection:established",
//             socketId,
//             userId: user.id,
//           });

//           // Setup message handlers
//           this.setupMessageHandlers(connection);

//           // Setup connection event handlers
//           ws.on("pong", () => {
//             connection.lastPing = new Date();
//             connection.isAlive = true;
//           });

//           ws.on("close", (code, reason) => {
//             console.log(
//               `🔴 User ${user.id} disconnected (Code: ${code}, Reason: ${reason})`
//             );
//             this.handleDisconnect(socketId);
//           });

//           ws.on("error", (error) => {
//             console.error(`💥 WebSocket error for user ${user.id}:`, error);
//             this.handleDisconnect(socketId);
//           });
//         } catch (error) {
//           console.error("💥 Error handling new connection:", error);
//           ws.close(1011, "Internal server error");
//         }
//       }
//     );

//     this.wss.on("error", (error) => {
//       console.error("💥 WebSocket server error:", error);
//     });
//   }

//   private async authenticateConnection(
//     request: IncomingMessage
//   ): Promise<AuthenticatedUser | null> {
//     try {
//       const authHeader = request.headers.authorization;
//       if (!authHeader || !authHeader.startsWith("Bearer ")) {
//         console.log("❌ No valid authorization header");
//         return null;
//       }

//       const token = authHeader.substring(7);
//       console.log(`🔍 Verifying token: ${token.substring(0, 10)}...`);

//       // Verify token with Supabase
//       const {
//         data: { user },
//         error,
//       } = await supabase.auth.getUser(token);

//       if (error || !user) {
//         console.log(
//           `❌ Token verification failed: ${error?.message || "No user found"}`
//         );
//         return null;
//       }

//       console.log(`✅ User authenticated: ${user.id} (${user.email})`);

//       return {
//         id: user.id,
//         email: user.email || "",
//         name: user.user_metadata?.["name"],
//       };
//     } catch (error) {
//       console.error("💥 Authentication error:", error);
//       return null;
//     }
//   }

//   private setupMessageHandlers(connection: WebSocketConnection): void {
//     const { ws, userId, socketId } = connection;

//     ws.on("message", async (data: Buffer) => {
//       try {
//         const message = data.toString();
//         console.log(`📨 Message from ${userId}: ${message}`);

//         let parsedMessage;
//         try {
//           parsedMessage = JSON.parse(message);
//         } catch {
//           // Handle plain text messages for backward compatibility
//           if (message === "user:join") {
//             await this.handleJoinWaitingRoom(connection);
//             return;
//           }
//           console.log("❌ Invalid message format");
//           return;
//         }

//         // Handle different message types
//         switch (parsedMessage.type) {
//           case "user:join":
//             await this.handleJoinWaitingRoom(connection);
//             break;
//           case "call:like":
//             await this.handleCallLike(connection, parsedMessage);
//             break;
//           case "call:dislike":
//             await this.handleCallDislike(connection, parsedMessage);
//             break;
//           case "call:end":
//             await this.handleCallEnd(connection);
//             break;
//           case "webrtc:offer":
//             await this.handleWebRTCOffer(connection, parsedMessage);
//             break;
//           case "webrtc:answer":
//             await this.handleWebRTCAnswer(connection, parsedMessage);
//             break;
//           case "webrtc:ice-candidate":
//             await this.handleWebRTCIceCandidate(connection, parsedMessage);
//             break;
//           case "ping":
//             this.sendMessage(ws, { type: "pong" });
//             break;
//           default:
//             console.log(`⚠️ Unknown message type: ${parsedMessage.type}`);
//         }
//       } catch (error) {
//         console.error("💥 Error handling message:", error);
//         this.sendError(ws, "Message processing failed");
//       }
//     });
//   }

//   private async handleJoinWaitingRoom(
//     connection: WebSocketConnection
//   ): Promise<void> {
//     const { userId, socketId } = connection;
//     console.log(`🎯 User ${userId} requesting to join waiting room`);

//     try {
//       // Update user as active in database
//       const { error: updateError } = await supabase
//         .from("users")
//         .update({
//           is_active: true,
//           last_active_at: new Date().toISOString(),
//         })
//         .eq("id", userId);

//       if (updateError) {
//         console.error("❌ Failed to update user in database:", updateError);
//       } else {
//         console.log("✅ User updated as active in database");
//       }

//       // Add to waiting room
//       await this.matchmakingService.addToWaitingRoom(userId, socketId);

//       // Try to find a match
//       const match = await this.matchmakingService.findMatch(userId);

//       if (match) {
//         console.log(`🎉 Match found! ${userId} <-> ${match.userId}`);

//         // Notify both users of match
//         this.sendMessage(connection.ws, {
//           type: "match:found",
//           partnerId: match.userId,
//           partnerSocketId: match.socketId,
//         });

//         const partnerConnection = this.connections.get(match.socketId);
//         if (partnerConnection) {
//           this.sendMessage(partnerConnection.ws, {
//             type: "match:found",
//             partnerId: userId,
//             partnerSocketId: socketId,
//           });
//         }

//         // Start call session
//         this.callService.startCall(userId, match.userId);
//         console.log(
//           `📞 Call session started between ${userId} and ${match.userId}`
//         );
//       } else {
//         console.log(
//           `⏳ No match found for user ${userId}, waiting for more users...`
//         );
//         this.sendMessage(connection.ws, {
//           type: "waiting:joined",
//           message: "Waiting for a match...",
//         });
//       }
//     } catch (error) {
//       console.error("💥 Error joining waiting room:", error);
//       this.sendError(connection.ws, "Failed to join waiting room");
//     }
//   }

//   private async handleCallLike(
//     connection: WebSocketConnection,
//     message: any
//   ): Promise<void> {
//     const { userId } = connection;
//     const { partnerId } = message;

//     console.log(`❤️ Like from user ${userId} for partner ${partnerId}`);

//     try {
//       const result = await this.callService.handleLike(userId, partnerId);

//       if (result.mutual) {
//         console.log(
//           `💕 Mutual like detected between ${userId} and ${partnerId}`
//         );
//         const contactInfo = await this.callService.shareContactInfo(
//           userId,
//           partnerId
//         );

//         // Notify both users
//         this.sendMessage(connection.ws, {
//           type: "contact:shared",
//           data: contactInfo,
//         });

//         const partnerConnection = this.findConnectionByUserId(partnerId);
//         if (partnerConnection) {
//           this.sendMessage(partnerConnection.ws, {
//             type: "contact:shared",
//             data: contactInfo,
//           });
//         }
//       }
//     } catch (error) {
//       console.error("💥 Error handling like:", error);
//       this.sendError(connection.ws, "Failed to process like");
//     }
//   }

//   private async handleCallDislike(
//     connection: WebSocketConnection,
//     message: any
//   ): Promise<void> {
//     const { userId } = connection;
//     const { partnerId } = message;

//     console.log(`👎 Dislike from user ${userId} for partner ${partnerId}`);

//     try {
//       await this.callService.handleDislike(userId, partnerId);
//     } catch (error) {
//       console.error("💥 Error handling dislike:", error);
//       this.sendError(connection.ws, "Failed to process dislike");
//     }
//   }

//   private async handleCallEnd(connection: WebSocketConnection): Promise<void> {
//     const { userId } = connection;
//     console.log(`📞 Call ended by user ${userId}`);

//     try {
//       // Remove from waiting room
//       this.matchmakingService.removeFromWaitingRoom(userId);

//       // Update user as inactive
//       await supabase
//         .from("users")
//         .update({
//           is_active: false,
//           last_active_at: new Date().toISOString(),
//         })
//         .eq("id", userId);

//       this.sendMessage(connection.ws, {
//         type: "call:ended",
//         message: "Call ended successfully",
//       });
//     } catch (error) {
//       console.error("💥 Error ending call:", error);
//       this.sendError(connection.ws, "Failed to end call");
//     }
//   }

//   private async handleWebRTCOffer(
//     connection: WebSocketConnection,
//     message: any
//   ): Promise<void> {
//     const { targetId, offer } = message;
//     console.log(`📡 WebRTC offer from ${connection.userId} to ${targetId}`);

//     const targetConnection = this.findConnectionByUserId(targetId);
//     if (targetConnection) {
//       this.sendMessage(targetConnection.ws, {
//         type: "webrtc:offer",
//         offer,
//         fromId: connection.userId,
//       });
//     }
//   }

//   private async handleWebRTCAnswer(
//     connection: WebSocketConnection,
//     message: any
//   ): Promise<void> {
//     const { targetId, answer } = message;
//     console.log(`📡 WebRTC answer from ${connection.userId} to ${targetId}`);

//     const targetConnection = this.findConnectionByUserId(targetId);
//     if (targetConnection) {
//       this.sendMessage(targetConnection.ws, {
//         type: "webrtc:answer",
//         answer,
//         fromId: connection.userId,
//       });
//     }
//   }

//   private async handleWebRTCIceCandidate(
//     connection: WebSocketConnection,
//     message: any
//   ): Promise<void> {
//     const { targetId, candidate } = message;
//     console.log(
//       `📡 WebRTC ICE candidate from ${connection.userId} to ${targetId}`
//     );

//     const targetConnection = this.findConnectionByUserId(targetId);
//     if (targetConnection) {
//       this.sendMessage(targetConnection.ws, {
//         type: "webrtc:ice-candidate",
//         candidate,
//         fromId: connection.userId,
//       });
//     }
//   }

//   private async handleDisconnect(socketId: string): Promise<void> {
//     const connection = this.connections.get(socketId);
//     if (connection) {
//       console.log(`🔴 Cleaning up connection for user ${connection.userId}`);

//       // Remove from waiting room
//       this.matchmakingService.removeFromWaitingRoom(connection.userId);

//       // Update user as inactive
//       const { error: updateError } = await supabase
//         .from("users")
//         .update({
//           is_active: false,
//           last_active_at: new Date().toISOString(),
//         })
//         .eq("id", connection.userId);

//       if (updateError) {
//         console.error(
//           "💥 Error updating user status on disconnect:",
//           updateError
//         );
//       } else {
//         console.log(
//           `✅ User ${connection.userId} status updated on disconnect`
//         );
//       }

//       this.connections.delete(socketId);
//     }
//   }

//   private findConnectionByUserId(
//     userId: string
//   ): WebSocketConnection | undefined {
//     return Array.from(this.connections.values()).find(
//       (conn) => conn.userId === userId
//     );
//   }

//   private sendMessage(ws: WebSocket, message: any): void {
//     try {
//       ws.send(JSON.stringify(message));
//     } catch (error) {
//       console.error("💥 Error sending message:", error);
//     }
//   }

//   private sendError(ws: WebSocket, error: string): void {
//     this.sendMessage(ws, {
//       type: "error",
//       message: error,
//     });
//   }

//   private generateSocketId(): string {
//     return `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
//   }

//   private startHeartbeat(): void {
//     this.pingInterval = setInterval(() => {
//       console.log(`💓 Pinging ${this.connections.size} connections...`);

//       this.connections.forEach((connection, socketId) => {
//         if (!connection.isAlive) {
//           console.log(`💀 Terminating dead connection: ${socketId}`);
//           connection.ws.terminate();
//           this.connections.delete(socketId);
//           return;
//         }

//         connection.isAlive = false;
//         connection.ws.ping();
//       });
//     }, this.PING_INTERVAL);
//   }

//   private startCleanup(): void {
//     this.cleanupInterval = setInterval(() => {
//       const now = new Date();
//       let cleanedCount = 0;

//       this.connections.forEach((connection, socketId) => {
//         const timeSinceLastPing = now.getTime() - connection.lastPing.getTime();
//         if (timeSinceLastPing > this.CONNECTION_TIMEOUT) {
//           console.log(`🗑️ Cleaning up stale connection: ${socketId}`);
//           connection.ws.terminate();
//           this.connections.delete(socketId);
//           cleanedCount++;
//         }
//       });

//       if (cleanedCount > 0) {
//         console.log(
//           `🧹 Cleanup complete: removed ${cleanedCount} stale connections`
//         );
//       }
//     }, this.CLEANUP_INTERVAL);
//   }

//   public getStats(): { totalConnections: number; activeConnections: number } {
//     const totalConnections = this.connections.size;
//     const activeConnections = Array.from(this.connections.values()).filter(
//       (conn) => conn.isAlive
//     ).length;

//     return { totalConnections, activeConnections };
//   }

//   public shutdown(): void {
//     console.log("🛑 Shutting down WebSocket Manager...");

//     if (this.pingInterval) {
//       clearInterval(this.pingInterval);
//     }

//     if (this.cleanupInterval) {
//       clearInterval(this.cleanupInterval);
//     }

//     this.connections.forEach((connection) => {
//       connection.ws.close(1001, "Server shutdown");
//     });

//     this.connections.clear();
//     this.wss.close();

//     console.log("✅ WebSocket Manager shutdown complete");
//   }
// }
