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
    console.log(
      `🎮 Adding user ${userId} (socket: ${socketId}) to waiting room`
    );

    this.waitingUsers.set(userId, {
      userId,
      socketId,
      joinedAt: new Date(),
    });

    console.log(`✅ User ${userId} added to waiting room`);
    console.log(`📊 Current waiting room size: ${this.waitingUsers.size}`);

    // Log all waiting users
    const waitingUserIds = Array.from(this.waitingUsers.keys());
    console.log(`👥 Users in waiting room: ${waitingUserIds.join(", ")}`);
  }

  async removeFromWaitingRoom(userId: string): Promise<void> {
    console.log(`🚪 Removing user ${userId} from waiting room`);

    const wasRemoved = this.waitingUsers.delete(userId);

    if (wasRemoved) {
      console.log(`✅ User ${userId} removed from waiting room`);
    } else {
      console.log(`⚠️ User ${userId} was not in waiting room`);
    }

    console.log(`📊 Current waiting room size: ${this.waitingUsers.size}`);
  }

  async findMatch(excludeUserId: string): Promise<Match | null> {
    console.log(`🔍 Finding match for user ${excludeUserId}`);
    console.log(`📊 Total users in waiting room: ${this.waitingUsers.size}`);

    // Get all waiting users except the requesting user
    const availableUsers = Array.from(this.waitingUsers.values()).filter(
      (user) => user.userId !== excludeUserId
    );

    console.log(`👥 Available users for matching: ${availableUsers.length}`);
    availableUsers.forEach((user) => {
      console.log(`  - ${user.userId} (socket: ${user.socketId})`);
    });

    if (availableUsers.length === 0) {
      console.log(
        `⏳ No available users for ${excludeUserId}, waiting for more users...`
      );
      return null;
    }

    // Simple random selection - could be enhanced with more sophisticated matching
    const randomIndex = Math.floor(Math.random() * availableUsers.length);
    const selectedUser = availableUsers[randomIndex];

    if (!selectedUser) {
      console.error("❌ No user selected from available users");
      return null;
    }

    console.log(`🎯 Selected user ${selectedUser.userId} for ${excludeUserId}`);

    // Remove both users from waiting room
    this.waitingUsers.delete(excludeUserId);
    this.waitingUsers.delete(selectedUser.userId);

    console.log(`🎉 Match found: ${excludeUserId} <-> ${selectedUser.userId}`);
    console.log(
      `📊 Remaining users in waiting room: ${this.waitingUsers.size}`
    );

    return {
      userId: selectedUser.userId,
      socketId: selectedUser.socketId,
    };
  }

  async getAllWaitingUsers(): Promise<WaitingUser[]> {
    console.log("📋 Getting all waiting users");
    const users = Array.from(this.waitingUsers.values());
    console.log(`📊 Total waiting users: ${users.length}`);
    return users;
  }

  async getWaitingRoomStats(): Promise<{ count: number }> {
    const count = this.waitingUsers.size;
    console.log(`📊 Waiting room stats: ${count} users`);
    return { count };
  }

  async cleanupInactiveUsers(): Promise<void> {
    console.log("🧹 Cleaning up inactive users...");

    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
    let cleanedCount = 0;

    for (const [userId, user] of this.waitingUsers.entries()) {
      const timeInWaiting = now.getTime() - user.joinedAt.getTime();
      if (timeInWaiting > inactiveThreshold) {
        this.waitingUsers.delete(userId);
        console.log(
          `🗑️ Removed inactive user ${userId} from waiting room (inactive for ${Math.round(
            timeInWaiting / 1000
          )}s)`
        );
        cleanedCount++;
      }
    }

    console.log(`✅ Cleanup complete: removed ${cleanedCount} inactive users`);
    console.log(`📊 Current waiting room size: ${this.waitingUsers.size}`);
  }
}
