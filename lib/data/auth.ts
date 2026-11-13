/**
 * ============================================================================
 * AUTHENTICATION DATA LAYER (/lib/data/auth.ts)
 * Phase A2: Supabase Auth with Google OAuth
 * ============================================================================
 */

import { createClient } from "@/lib/supabase/client";
import { Owner } from "../types";

/**
 * Get the currently logged-in owner from Supabase session.
 * Returns null if not logged in.
 */
export async function getCurrentOwner(): Promise<Owner | null> {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  // Fetch profile for name and phone
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, mobile")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    name: profile?.full_name || user.user_metadata?.full_name || user.email || "Owner",
    phone: profile?.mobile || "",
    createdAt: user.created_at,
  };
}

/**
 * Sign out the current user.
 */
export async function logoutOwner(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

/**
 * Check if the logged-in user has completed their profile (name + phone).
 * Returns true if profile is complete.
 */
export async function isProfileComplete(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, mobile")
    .eq("id", user.id)
    .single();

  return !!(profile?.full_name?.trim() && profile?.mobile?.trim());
}

// Legacy stubs kept so existing imports don't break during transition
// These are no longer used but prevent compile errors if referenced
export async function signupOwner() { return { success: false, error: 'Use Google login' }; }
export async function loginOwner() { return { success: false, error: 'Use Google login' }; }
