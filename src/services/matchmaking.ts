import { supabaseAdmin } from "../config/supabase";

interface WaitingUser {
  userId: string;
  socketId: string;
  joinedAt: Date;
}

interface Match {
  userId: string;
  socketId: string;
}

export class MatchmakingService {
  private waitingUsers: Map<string, WaitingUser> = new Map();

  async addToWaitingRoom(userId: string, socketId: string): Promise<void> {
    this.waitingUsers.set(userId, {
      userId,
      socketId,
      joinedAt: new Date(),
    });

    console.log(`User ${userId} added to waiting room`);
  }

  async removeFromWaitingRoom(userId: string): Promise<void> {
    this.waitingUsers.delete(userId);
    console.log(`User ${userId} removed from waiting room`);
  }

  async findMatch(excludeUserId: string): Promise<Match | null> {
    // Get all waiting users except the requesting user
    const availableUsers = Array.from(this.waitingUsers.values()).filter(
      (user) => user.userId !== excludeUserId
    );

    if (availableUsers.length === 0) {
      return null;
    }

    // Simple random selection - could be enhanced with more sophisticated matching
    const randomIndex = Math.floor(Math.random() * availableUsers.length);
    const selectedUser = availableUsers[randomIndex];

    if (!selectedUser) {
      console.error("No user selected");
      return null;
    }

    // Remove both users from waiting room
    this.waitingUsers.delete(excludeUserId);
    this.waitingUsers.delete(selectedUser.userId);

    console.log(`Match found: ${excludeUserId} <-> ${selectedUser.userId}`);

    return {
      userId: selectedUser.userId,
      socketId: selectedUser.socketId,
    };
  }

  async getWaitingRoomStats(): Promise<{ count: number }> {
    return {
      count: this.waitingUsers.size,
    };
  }

  async cleanupInactiveUsers(): Promise<void> {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [userId, user] of this.waitingUsers.entries()) {
      if (now.getTime() - user.joinedAt.getTime() > inactiveThreshold) {
        this.waitingUsers.delete(userId);
        console.log(`Removed inactive user ${userId} from waiting room`);
      }
    }
  }
}
