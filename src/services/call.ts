import { supabaseAdmin } from "../config/supabase";

interface CallSession {
  userId1: string;
  userId2: string;
  startTime: Date;
  likes: Set<string>;
  dislikes: Set<string>;
}

interface ContactInfo {
  user: {
    id: string;
    name: string;
    email: string;
  };
  profile: {
    phone_number?: string;
    instagram_handle?: string;
    tiktok_handle?: string;
    twitter_handle?: string;
    linkedin_url?: string;
  };
}

export class CallService {
  private activeCalls: Map<string, CallSession> = new Map();

  async startCall(userId1: string, userId2: string): Promise<void> {
    const callKey = this.getCallKey(userId1, userId2);

    this.activeCalls.set(callKey, {
      userId1,
      userId2,
      startTime: new Date(),
      likes: new Set(),
      dislikes: new Set(),
    });

    console.log(`Call started between ${userId1} and ${userId2}`);
  }

  async handleLike(
    userId: string,
    partnerId: string
  ): Promise<{ mutual: boolean }> {
    const callKey = this.getCallKey(userId, partnerId);
    const call = this.activeCalls.get(callKey);

    if (!call) {
      throw new Error("No active call found");
    }

    call.likes.add(userId);

    // Check if both users liked each other
    const mutual = call.likes.has(call.userId1) && call.likes.has(call.userId2);

    if (mutual) {
      console.log(`Mutual like detected between ${userId} and ${partnerId}`);
    }

    return { mutual };
  }

  async handleDislike(userId: string, partnerId: string): Promise<void> {
    const callKey = this.getCallKey(userId, partnerId);
    const call = this.activeCalls.get(callKey);

    if (!call) {
      throw new Error("No active call found");
    }

    call.dislikes.add(userId);
    console.log(`User ${userId} disliked ${partnerId}`);
  }

  async shareContactInfo(
    userId1: string,
    userId2: string
  ): Promise<ContactInfo[]> {
    // Get both users' contact information
    const [user1Info, user2Info] = await Promise.all([
      this.getUserContactInfo(userId1),
      this.getUserContactInfo(userId2),
    ]);

    // Create contact records for both users
    await Promise.all([
      this.createContactRecord(userId1, userId2, user2Info),
      this.createContactRecord(userId2, userId1, user1Info),
    ]);

    return [user1Info, user2Info];
  }

  private async getUserContactInfo(userId: string): Promise<ContactInfo> {
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      throw new Error("User not found");
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select(
        "phone_number, instagram_handle, tiktok_handle, twitter_handle, linkedin_url"
      )
      .eq("user_id", userId)
      .single();

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      profile: profile || {},
    };
  }

  private async createContactRecord(
    userId: string,
    contactUserId: string,
    contactInfo: ContactInfo
  ): Promise<void> {
    const { error } = await supabaseAdmin.from("user_contacts").upsert(
      {
        user_id: userId,
        contact_user_id: contactUserId,
        contact_name: contactInfo.user.name,
        phone_number: contactInfo.profile.phone_number,
        instagram_handle: contactInfo.profile.instagram_handle,
        tiktok_handle: contactInfo.profile.tiktok_handle,
        twitter_handle: contactInfo.profile.twitter_handle,
        linkedin_url: contactInfo.profile.linkedin_url,
        matched_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,contact_user_id",
      }
    );

    if (error) {
      console.error("Error creating contact record:", error);
      throw new Error("Failed to create contact record");
    }
  }

  async endCall(userId: string, partnerId: string): Promise<void> {
    const callKey = this.getCallKey(userId, partnerId);
    this.activeCalls.delete(callKey);
    console.log(`Call ended between ${userId} and ${partnerId}`);
  }

  private getCallKey(userId1: string, userId2: string): string {
    // Ensure consistent ordering for call key
    const sortedIds = [userId1, userId2].sort();
    return `${sortedIds[0]}-${sortedIds[1]}`;
  }

  async getActiveCallStats(): Promise<{ count: number }> {
    return {
      count: this.activeCalls.size,
    };
  }
}
