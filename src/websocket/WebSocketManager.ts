import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { supabase } from "../config/supabase";
import { MatchmakingService } from "../services/matchmaking";
import { CallService } from "../services/call";
import { AutoMatchService } from "../services/automatch";

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
}


export class WebSocketManager {
  private wss: WebSocketServer;
  private connections: Map<string, WebSocketConnection> = new Map();
  private matchmakingService: MatchmakingService;
  private callService: CallService;
  private autoMatchService: AutoMatchService;
  private pingInterval!: NodeJS.Timeout;
  private cleanupInterval!: NodeJS.Timeout;
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute
  
  constructor(server: any) {
    this.wss = new WebSocketServer({
      server,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3,
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024,
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024,
      },
    });

    this.matchmakingService = new MatchmakingService();
    this.callService = new CallService();
    this.autoMatchService = new AutoMatchService(this.matchmakingService, this.callService);

    // Register callback for automatic matches
    this.autoMatchService.onMatch(this.handleAutoMatch.bind(this));

    // Setup WebSocket connection handling
    this.setupEventHandlers();

    // Start the auto-matching service
    this.autoMatchService.startAutoMatching();

    // Setup heartbeat and cleanup intervals
    this.startHeartbeat();
    this.startCleanup();

    console.log(" WebSocketManager initialized with auto-matching enabled");
  }

  private setupEventHandlers(): void {
    this.wss.on(
      "connection",
      async (ws: WebSocket, request: IncomingMessage) => {
        try {
          console.log(
            ` New WebSocket connection from ${request.socket.remoteAddress}`
          );

          // Set a longer timeout for the socket
          if (request.socket.setTimeout) {
            request.socket.setTimeout(0); // Disable timeout
          }

          // Authenticate the connection
          const user = await this.authenticateConnection(request);
          if (!user) {
            console.log(" Authentication failed, closing connection");
            ws.close(1008, "Authentication failed");
            return;
          }

          const socketId = this.generateSocketId();
          const connection: WebSocketConnection = {
            ws,
            user,
            userId: user.id,
            socketId,
            connectedAt: new Date(),
          };

          this.connections.set(socketId, connection);
          console.log(
            ` User ${user.id} authenticated and connected (Socket: ${socketId})`
          );

          // Send welcome message
          this.sendMessage(ws, {
            type: "connection:established",
            socketId,
            userId: user.id,
          });

          // Automatically join the waiting room upon connection
          this.handleJoinWaitingRoom(connection)
            .then(() => {
              console.log(` User ${user.id} automatically joined waiting room`);
            })
            .catch((error) => {
              console.error(` Error auto-joining waiting room:`, error);
            });

          // Setup message handlers
          this.setupMessageHandlers(connection);

          ws.on("close", (code, reason) => {
            console.log(
              ` User ${user.id} disconnected (Code: ${code}, Reason: ${reason})`
            );
            this.handleDisconnect(socketId);
          });

          ws.on("error", (error) => {
            console.error(` WebSocket error for user ${user.id}:`, error);
            this.handleDisconnect(socketId);
          });
        } catch (error) {
          console.error(" Error handling new connection:", error);
          ws.close(1011, "Internal server error");
        }
      }
    );

    this.wss.on("error", (error) => {
      console.error(" WebSocket server error:", error);
    });
  }

  private async authenticateConnection(
    _request: IncomingMessage
  ): Promise<AuthenticatedUser | null> {
    try {
      // TESTING MODE: Skip authentication and use a test user
      console.log(" TESTING MODE: Skipping authentication");
      return {
        id: "test-user-" + Math.random().toString(36).substring(2, 10),
        email: "test@example.com",
        name: "Test User",
      };

      // Real authentication code (commented out for testing)
      /*
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.log(" No valid authorization header");
        return null;
      }

      const token = authHeader.split(" ")[1];
      const { data, error } = await this.supabase.auth.getUser(token);

      if (error || !data.user) {
        console.log(" Authentication failed:", error?.message);
        return null;
      }

      const user = data.user;
      console.log(" Authenticated user:", user.id);

      return {
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.["name"],
      };
      */
    } catch (error) {
      console.error(" Authentication error:", error);
      return null;
    }
  }

  private setupMessageHandlers(connection: WebSocketConnection): void {
    const { ws, userId } = connection;

    ws.on("message", async (data: Buffer) => {
      try {
        const message = data.toString();
        console.log(` Message from ${userId}: ${message}`);

        let parsedMessage;
        try {
          parsedMessage = JSON.parse(message);
        } catch {
          // Handle plain text messages for backward compatibility
          if (message === "user:join") {
            await this.handleJoinWaitingRoom(connection);
            return;
          }
          console.log(" Invalid message format");
          return;
        }

        // Handle different message types 
        switch (parsedMessage.type) {
          case "user:join":
            await this.handleJoinWaitingRoom(connection);
            break;
          case "call:like":
            await this.handleCallLike(connection, parsedMessage);
            break;
          case "call:dislike":
            await this.handleCallDislike(connection, parsedMessage);
            break;
          case "call:end":
            await this.handleCallEnd(connection);
            break;
          case "webrtc:offer":
            await this.handleWebRTCOffer(connection, parsedMessage);
            break;
          case "webrtc:answer":
            await this.handleWebRTCAnswer(connection, parsedMessage);
            break;
          case "webrtc:ice-candidate":
            await this.handleWebRTCIceCandidate(connection, parsedMessage);
            break;
          case "ping":
            this.sendMessage(ws, { type: "pong" });
            break;
          default:
            console.log(` Unknown message type: ${parsedMessage.type}`);
        }
      } catch (error) {
        console.error(" Error handling message:", error);
        this.sendError(ws, "Message processing failed");
      }
    });
  }

  /**
   * Handle a user joining the waiting room
   */
  private async handleJoinWaitingRoom(connection: WebSocketConnection): Promise<void> {
    const { userId, socketId } = connection;
    if (!userId || !socketId) {
      console.error(" Missing userId or socketId in connection");
      return;
    }

    try {
      console.log(` User ${userId} joining waiting room`);
      
      // Add user to waiting room
      await this.matchmakingService.addToWaitingRoom(userId, socketId);
      
      // Notify user they've joined the waiting room
      this.sendMessage(connection.ws, {
        type: "waiting:joined",
        message: "You've joined the waiting room. Please wait for a match...",
      });
      
      console.log(` User ${userId} added to waiting room`);
      
      // Note: We don't immediately find a match here
      // The AutoMatchService will periodically match users
    } catch (error) {
      console.error(` Error adding user ${userId} to waiting room:`, error);
      this.sendMessage(connection.ws, {
        type: "error",
        message: "Failed to join waiting room. Please try again.",
      });
    }
  }

  /**
   * Handle automatic matches created by the AutoMatchService
   */
  private handleAutoMatch(matchedPair: {
    user1Id: string;
    user1SocketId: string;
    user2Id: string;
    user2SocketId: string;
  }): void {
    console.log(` Notifying matched users: ${matchedPair.user1Id} and ${matchedPair.user2Id}`);
    
    // Get connections for both users
    const user1Connection = this.getConnectionBySocketId(matchedPair.user1SocketId);
    const user2Connection = this.getConnectionBySocketId(matchedPair.user2SocketId);
    
    if (!user1Connection || !user2Connection) {
      console.error(" One or both users are no longer connected");
      return;
    }
    
    // Notify first user about their match
    this.sendMessage(user1Connection.ws, {
      type: "match:found",
      message: "You've been matched with someone!",
      data: {
        partnerId: matchedPair.user2Id,
        callId: this.callService.getCallId(matchedPair.user1Id, matchedPair.user2Id),
      },
    });
    
    // Notify second user about their match
    this.sendMessage(user2Connection.ws, {
      type: "match:found",
      message: "You've been matched with someone!",
      data: {
        partnerId: matchedPair.user1Id,
        callId: this.callService.getCallId(matchedPair.user1Id, matchedPair.user2Id),
      },
    });
    
    console.log(` Match notifications sent to both users`);
  }

  /**
   * Get a connection by socket ID
   */
  private getConnectionBySocketId(socketId: string): WebSocketConnection | undefined {
    for (const [_, connection] of this.connections) {
      if (connection.socketId === socketId) {
        return connection;
      }
    }
    return undefined;
  }

  private async handleCallLike(
    connection: WebSocketConnection,
    message: any
  ): Promise<void> {
    const { userId } = connection;
    const { partnerId } = message;

    console.log(` Like from user ${userId} for partner ${partnerId}`);

    try {
      const result = await this.callService.handleLike(userId, partnerId);

      if (result.mutual) {
        console.log(
          ` Mutual like detected between ${userId} and ${partnerId}`
        );
        const contactInfo = await this.callService.shareContactInfo(
          userId,
          partnerId
        );

        // Notify both users
        this.sendMessage(connection.ws, {
          type: "contact:shared",
          data: contactInfo,
        });

        const partnerConnection = this.findConnectionByUserId(partnerId);
        if (partnerConnection) {
          this.sendMessage(partnerConnection.ws, {
            type: "contact:shared",
            data: contactInfo,
          });
        }
      }
    } catch (error) {
      console.error(" Error handling like:", error);
      this.sendError(connection.ws, "Failed to process like");
    }
  }

  private async handleCallDislike(
    connection: WebSocketConnection,
    message: any
  ): Promise<void> {
    const { userId } = connection;
    const { partnerId } = message;

    console.log(` Dislike from user ${userId} for partner ${partnerId}`);

    try {
      await this.callService.handleDislike(userId, partnerId);
    } catch (error) {
      console.error(" Error handling dislike:", error);
      this.sendError(connection.ws, "Failed to process dislike");
    }
  }

  private async handleCallEnd(connection: WebSocketConnection): Promise<void> {
    const { userId } = connection;
    console.log(` Call ended by user ${userId}`);

    try {
      // Remove from waiting room
      this.matchmakingService.removeFromWaitingRoom(userId);

      // Update user as inactive
      await supabase
        .from("users")
        .update({
          is_active: false,
          last_active_at: new Date().toISOString(),
        })
        .eq("id", userId);

      console.log(` User ${userId} marked as inactive`);
    } catch (error) {
      console.error(" Error handling call end:", error);
    }
  }

  private async handleWebRTCOffer(
    connection: WebSocketConnection,
    message: any
  ): Promise<void> {
    const { userId } = connection;
    const { targetUserId, offer } = message;

    console.log(` WebRTC offer from ${userId} to ${targetUserId}`);

    try {
      const targetConnection = this.findConnectionByUserId(targetUserId);
      if (!targetConnection) {
        console.log(` Target user ${targetUserId} not connected`);
        this.sendError(connection.ws, "Target user not connected");
        return;
      }

      this.sendMessage(targetConnection.ws, {
        type: "webrtc:offer",
        fromUserId: userId,
        offer,
      });
    } catch (error) {
      console.error(" Error handling WebRTC offer:", error);
      this.sendError(connection.ws, "Failed to relay WebRTC offer");
    }
  }

  private async handleWebRTCAnswer(
    connection: WebSocketConnection,
    message: any
  ): Promise<void> {
    const { userId } = connection;
    const { targetUserId, answer } = message;

    console.log(` WebRTC answer from ${userId} to ${targetUserId}`);

    try {
      const targetConnection = this.findConnectionByUserId(targetUserId);
      if (!targetConnection) {
        console.log(` Target user ${targetUserId} not connected`);
        this.sendError(connection.ws, "Target user not connected");
        return;
      }

      this.sendMessage(targetConnection.ws, {
        type: "webrtc:answer",
        fromUserId: userId,
        answer,
      });
    } catch (error) {
      console.error(" Error handling WebRTC answer:", error);
      this.sendError(connection.ws, "Failed to relay WebRTC answer");
    }
  }

  private async handleWebRTCIceCandidate(
    connection: WebSocketConnection,
    message: any
  ): Promise<void> {
    const { userId } = connection;
    const { targetUserId, candidate } = message;

    console.log(` WebRTC ICE candidate from ${userId} to ${targetUserId}`);

    try {
      const targetConnection = this.findConnectionByUserId(targetUserId);
      if (!targetConnection) {
        console.log(` Target user ${targetUserId} not connected`);
        return;
      }

      this.sendMessage(targetConnection.ws, {
        type: "webrtc:ice-candidate",
        fromUserId: userId,
        candidate,
      });
    } catch (error) {
      console.error(" Error handling WebRTC ICE candidate:", error);
    }
  }

  private handleDisconnect(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (!connection) {
      console.log(` No connection found for socket ID: ${socketId}`);
      return;
    }

    const { userId } = connection;
    console.log(` User ${userId} disconnected`);

    // Remove from connections
    this.connections.delete(socketId);

    // Remove from waiting room if present
    this.matchmakingService.removeFromWaitingRoom(userId)
      .then(() => {
        console.log(` User ${userId} removed from waiting room`);
      })
      .catch((error: any) => {
        console.error(` Error removing user ${userId} from waiting room:`, error);
      });

    // Update user status in database
    try {
      // Use Promise.resolve to convert PromiseLike to Promise
      Promise.resolve(
        supabase
          .from("users")
          .update({
            is_active: false,
            last_active_at: new Date().toISOString(),
          })
          .eq("id", userId)
      )
        .then(() => {
          console.log(` User ${userId} marked as inactive`);
        })
        .catch((error: any) => {
          console.error(" Failed to update user status:", error);
        });
    } catch (error) {
      console.error(" Error updating user status:", error);
    }
  }

  private findConnectionByUserId(userId: string): WebSocketConnection | undefined {
    for (const connection of this.connections.values()) {
      if (connection.userId === userId) {
        return connection;
      }
    }
    return undefined;
  }

  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      console.log("🔄 Heartbeat check (test mode, no disconnects)");
  
      this.connections.forEach((connection) => {
        try {
          // Application-level ping message
          this.sendMessage(connection.ws, { type: "ping" });
        } catch (error) {
          console.error(`❌ Error sending ping to ${connection.userId}:`, error);
        }
      });
    }, this.PING_INTERVAL);
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      console.log("🧹 Cleanup (test mode) - not disconnecting any users");
  
      // Optional: keep this if you still want to clean up the waiting room
      this.matchmakingService.cleanupInactiveUsers();
    }, this.CLEANUP_INTERVAL);
  }

  public getStats(): any {
    return {
      connections: this.connections.size,
      waitingRoom: this.matchmakingService.getWaitingRoomStats(),
    };
  }

  public shutdown(): void {
    console.log(" Shutting down WebSocketManager...");

    // Stop the auto-matching service
    this.autoMatchService.stopAutoMatching();

    // Clear intervals
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    // Close all connections
    for (const [_, connection] of this.connections) {
      connection.ws.close(1000, "Server shutting down");
    }

    // Close the WebSocket server
    this.wss.close();

    console.log(" WebSocketManager shutdown complete");
  }

  private generateSocketId(): string {
    return `socket_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
  }

  private sendMessage(ws: WebSocket, message: any): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(" Error sending message:", error);
    }
  }

  private sendError(ws: WebSocket, message: string): void {
    try {
      ws.send(
        JSON.stringify({
          type: "error",
          message,
        })
      );
    } catch (error) {
      console.error(" Error sending error message:", error);
    }
  }
}
