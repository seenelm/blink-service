import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env["SUPABASE_URL"];
const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"];

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Client for all operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const initializeSupabase = (): void => {
  console.log("🔗 Supabase client initialized");
};

// Database types based on our schema
export interface User {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  phone_number?: string;
  instagram_handle?: string;
  tiktok_handle?: string;
  twitter_handle?: string;
  linkedin_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserContact {
  id: string;
  user_id: string;
  contact_user_id: string;
  contact_name?: string;
  phone_number?: string;
  instagram_handle?: string;
  tiktok_handle?: string;
  twitter_handle?: string;
  linkedin_url?: string;
  matched_at: string;
  created_at: string;
  updated_at: string;
}
