import { MatchmakingService } from "./matchmaking";
import { CallService } from "./call";

interface MatchedPair {
  user1Id: string;
  user1SocketId: string;
  user2Id: string;
  user2SocketId: string;
}

export type MatchCallback = (matchedPair: MatchedPair) => void;

export class AutoMatchService {
  private matchmakingService: MatchmakingService;
  private callService: CallService;
  private matchingInterval: NodeJS.Timeout | null = null;
  private readonly MATCHING_INTERVAL_MS = 5000; // Run matching every 5 seconds
  private matchCallbacks: MatchCallback[] = [];

  constructor(matchmakingService: MatchmakingService, callService: CallService) {
    this.matchmakingService = matchmakingService;
    this.callService = callService;
    console.log("🤖 AutoMatchService initialized");
  }

  /**
   * Register a callback to be called when users are matched
   */
  onMatch(callback: MatchCallback): void {
    this.matchCallbacks.push(callback);
  }

  /**
   * Start the automatic matching process
   */
  startAutoMatching(): void {
    if (this.matchingInterval) {
      clearInterval(this.matchingInterval);
    }

    console.log("🔄 Starting automatic matching service");
    this.matchingInterval = setInterval(
      this.performMatching.bind(this),
      this.MATCHING_INTERVAL_MS
    );
  }

  /**
   * Stop the automatic matching process
   */
  stopAutoMatching(): void {
    if (this.matchingInterval) {
      clearInterval(this.matchingInterval);
      this.matchingInterval = null;
      console.log("⏹️ Automatic matching service stopped");
    }
  }

  /**
   * Perform a matching cycle - find all possible pairs from waiting users
   */
  async performMatching(): Promise<MatchedPair[]> {
    console.log("🔍 Running automatic matching cycle");
    
    // Get all users in the waiting room
    const waitingUsers = await this.matchmakingService.getAllWaitingUsers();
    console.log(`👥 Found ${waitingUsers.length} users in waiting room`);
    
    if (waitingUsers.length < 2) {
      console.log("⏳ Not enough users for matching");
      return [];
    }

    // Shuffle the users for random matching
    const shuffledUsers = this.shuffleArray([...waitingUsers]);
    const matchedPairs: MatchedPair[] = [];

    // Match users in pairs
    for (let i = 0; i < shuffledUsers.length - 1; i += 2) {
      const user1 = shuffledUsers[i];
      const user2 = shuffledUsers[i + 1];
      
      // Skip if we don't have a complete pair
      if (!user1 || !user2) continue;

      console.log(`🎯 Matching ${user1.userId} with ${user2.userId}`);
      
      // Remove both users from waiting room
      await this.matchmakingService.removeFromWaitingRoom(user1.userId);
      await this.matchmakingService.removeFromWaitingRoom(user2.userId);
      
      // Start call session
      await this.callService.startCall(user1.userId, user2.userId);
      
      const matchedPair = {
        user1Id: user1.userId,
        user1SocketId: user1.socketId,
        user2Id: user2.userId,
        user2SocketId: user2.socketId
      };
      
      matchedPairs.push(matchedPair);
      
      // Notify all registered callbacks about the match
      this.notifyMatchCallbacks(matchedPair);
      
      console.log(`🎉 Match created: ${user1.userId} <-> ${user2.userId}`);
    }

    console.log(`✅ Matching cycle complete: ${matchedPairs.length} pairs created`);
    return matchedPairs;
  }

  /**
   * Notify all registered callbacks about a match
   */
  private notifyMatchCallbacks(matchedPair: MatchedPair): void {
    for (const callback of this.matchCallbacks) {
      try {
        callback(matchedPair);
      } catch (error) {
        console.error("💥 Error in match callback:", error);
      }
    }
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      // Use non-null assertion to tell TypeScript these values are definitely not undefined
      [array[i], array[j]] = [array[j]!, array[i]!];
    }
    return array;
  }
}
