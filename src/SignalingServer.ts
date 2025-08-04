// SignalingServer.ts
import WebSocket, { WebSocketServer } from "ws";
import { IncomingMessage } from "http";

interface User {
  name: string;
  socket: WebSocket;
}

interface SignalMessage {
  type: string;
  name: string;
  target?: string;
  data?: any;
}

export class SignalingServer {
  private wss: WebSocketServer;
  private users: User[] = [];

  constructor(server: any) {
    this.wss = new WebSocketServer({ server });
    this.wss.on("connection", this.handleConnection.bind(this));
  }

  private handleConnection(socket: WebSocket, _req: IncomingMessage): void {
    console.log("Client connected");

    socket.on("message", (raw: WebSocket.RawData) => {
      try {
        const data: SignalMessage = JSON.parse(raw.toString());
        this.handleMessage(socket, data);
      } catch (err) {
        console.error("Invalid message format", err);
      }
    });

    socket.on("close", () => {
      this.users = this.users.filter((user) => user.socket !== socket);
      console.log("Client disconnected");
    });
  }

  private findUser(name: string): User | undefined {
    return this.users.find((user) => user.name === name);
  }

  private handleMessage(socket: WebSocket, data: SignalMessage): void {
    switch (data.type) {
      case "store_user":
        if (this.findUser(data.name)) {
          socket.send(JSON.stringify({ type: "user already exists" }));
        } else {
          this.users.push({ name: data.name, socket });
        }
        break;

      case "start_call":
        const target = this.findUser(data.target!);
        socket.send(
          JSON.stringify({
            type: "call_response",
            data: target ? "user is ready for call" : "user is not online",
          })
        );
        break;

      case "create_offer":
        const receiverForOffer = this.findUser(data.target!);
        if (receiverForOffer) {
          receiverForOffer.socket.send(
            JSON.stringify({
              type: "offer_received",
              name: data.name,
              data: data.data.sdp,
            })
          );
        }
        break;

      case "create_answer":
        const receiverForAnswer = this.findUser(data.target!);
        if (receiverForAnswer) {
          receiverForAnswer.socket.send(
            JSON.stringify({
              type: "answer_received",
              name: data.name,
              data: data.data.sdp,
            })
          );
        }
        break;

      case "ice_candidate":
        const receiverForIce = this.findUser(data.target!);
        if (receiverForIce) {
          receiverForIce.socket.send(
            JSON.stringify({
              type: "ice_candidate",
              name: data.name,
              data: {
                sdpMLineIndex: data.data.sdpMLineIndex,
                sdpMid: data.data.sdpMid,
                sdpCandidate: data.data.sdpCandidate,
              },
            })
          );
        }
        break;

      default:
        console.warn("Unknown message type:", data.type);
    }
  }
}
