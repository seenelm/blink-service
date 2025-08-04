import { supabase } from "../config/supabase";

interface LikeResult {
  mutual: boolean;
  contactInfo?: any;
}

interface CallSession {
  user1Id: string;
  user2Id: string;
  startTime: Date;
  endTime?: Date;
}

export class CallService {
  private activeCalls: Map<string, CallSession> = new Map();

  async startCall(user1Id: string, user2Id: string): Promise<void> {
    const callId = this.getCallId(user1Id, user2Id);
    this.activeCalls.set(callId, {
      user1Id,
      user2Id,
      startTime: new Date(),
    });

    console.log(`Call started: ${user1Id} <-> ${user2Id}`);
  }

  async endCall(user1Id: string, user2Id: string): Promise<void> {
    const callId = this.getCallId(user1Id, user2Id);
    const call = this.activeCalls.get(callId);
    if (call) {
      call.endTime = new Date();
      console.log(`Call ended: ${user1Id} <-> ${user2Id}`);
    }
  }

  async handleLike(userId: string, partnerId: string): Promise<LikeResult> {
    const callId = this.getCallId(userId, partnerId);
    const call = this.activeCalls.get(callId);

    if (!call) {
      throw new Error("No active call found");
    }

    // Check if partner also liked this user
    const partnerCallId = this.getCallId(partnerId, userId);
    const partnerCall = this.activeCalls.get(partnerCallId);

    if (partnerCall) {
      // Both users liked each other
      const contactInfo = await this.shareContactInfo(userId, partnerId);
      return { mutual: true, contactInfo };
    }

    return { mutual: false };
  }

  async handleDislike(userId: string, partnerId: string): Promise<void> {
    const callId = this.getCallId(userId, partnerId);
    this.activeCalls.delete(callId);

    console.log(`User ${userId} disliked ${partnerId}`);
  }

  async shareContactInfo(userId: string, partnerId: string): Promise<any> {
    try {
      // Get user profiles
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError) throw userError;

      const { data: partner, error: partnerError } = await supabase
        .from("users")
        .select("*")
        .eq("id", partnerId)
        .single();

      if (partnerError) throw partnerError;

      // Get user profiles with contact info
      const { data: userProfile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        throw profileError;
      }

      const { data: partnerProfile, error: partnerProfileError } =
        await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", partnerId)
          .single();

      if (partnerProfileError && partnerProfileError.code !== "PGRST116") {
        throw partnerProfileError;
      }

      // Create contact records for both users
      const contactData = {
        user_id: userId,
        contact_user_id: partnerId,
        contact_name: partner.name,
        phone_number: partnerProfile?.phone_number,
        instagram_handle: partnerProfile?.instagram_handle,
        tiktok_handle: partnerProfile?.tiktok_handle,
        twitter_handle: partnerProfile?.twitter_handle,
        linkedin_url: partnerProfile?.linkedin_url,
        matched_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("user_contacts")
        .upsert(contactData);
      if (error) throw error;

      // Create reverse contact record
      const reverseContactData = {
        user_id: partnerId,
        contact_user_id: userId,
        contact_name: user.name,
        phone_number: userProfile?.phone_number,
        instagram_handle: userProfile?.instagram_handle,
        tiktok_handle: userProfile?.tiktok_handle,
        twitter_handle: userProfile?.twitter_handle,
        linkedin_url: userProfile?.linkedin_url,
        matched_at: new Date().toISOString(),
      };

      const { error: reverseError } = await supabase
        .from("user_contacts")
        .upsert(reverseContactData);
      if (reverseError) throw reverseError;

      console.log(`Contact info shared between ${userId} and ${partnerId}`);

      return {
        partnerName: partner.name,
        partnerEmail: partner.email,
        contactInfo: {
          phoneNumber: partnerProfile?.phone_number,
          instagramHandle: partnerProfile?.instagram_handle,
          tiktokHandle: partnerProfile?.tiktok_handle,
          twitterHandle: partnerProfile?.twitter_handle,
          linkedinUrl: partnerProfile?.linkedin_url,
        },
      };
    } catch (error) {
      console.error("Error sharing contact info:", error);
      throw error;
    }
  }

  /**
   * Get a unique call ID for a pair of users
   * This ensures the same call ID is generated regardless of the order of user IDs
   */
  public getCallId(user1Id: string, user2Id: string): string {
    // Create a consistent call ID regardless of user order
    const sortedIds = [user1Id, user2Id].sort();
    return `${sortedIds[0]}-${sortedIds[1]}`;
  }
}
