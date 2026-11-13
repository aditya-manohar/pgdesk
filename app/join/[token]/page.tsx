"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  Chrome,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  LogOut,
} from "lucide-react";

interface InvitePreview {
  tenant_name: string;
  pg_name: string;
  room: string;
  bed: string;
}

export default function JoinInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  // Invite preview data
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isOwnerError, setIsOwnerError] = useState(false);

  // Helper to extract safe human-facing database message
  const getFriendlyError = (err: unknown): { message: string; isOwner: boolean } => {
    const raw = (err && typeof err === "object" && "message" in err)
      ? String((err as { message: unknown }).message)
      : String(err || "");

    const lower = raw.toLowerCase();

    // Check if user is the PG owner
    if (lower.includes("owner of this pg") || lower.includes("you are the owner")) {
      return {
        message: raw,
        isOwner: true,
      };
    }

    // Check for known invalid/expired/cancelled invite errors from the database
    if (
      lower.includes("invalid") ||
      lower.includes("expired") ||
      lower.includes("already been claimed") ||
      lower.includes("cancelled") ||
      lower.includes("not found")
    ) {
      return {
        message: raw,
        isOwner: false,
      };
    }

    // Any other error: show generic message and log real error to console only
    return {
      message: "Something went wrong. Please try again.",
      isOwner: false,
    };
  };

  useEffect(() => {
    async function init() {
      if (!token) {
        setErrorMessage("Invalid invite link. Please check the URL.");
        setCheckingAuth(false);
        return;
      }

      const supabase = createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Rule 6: Console-log whether a user exists before each RPC call
      console.log("[JoinPage] Pre-RPC auth check - User exists:", !!currentUser, currentUser ? currentUser.id : "none");

      if (!currentUser) {
        // Rule 1: No user: show "You've been invited" with "Continue with Google" and make no RPC call
        setUser(null);
        setCheckingAuth(false);
        return;
      }

      setUser({ id: currentUser.id, email: currentUser.email });

      // User exists: call preview_invite using session-aware client
      try {
        console.log("[JoinPage] Calling preview_invite for token:", token, "User authenticated:", true);
        const { data, error } = await supabase.rpc("preview_invite", {
          p_token: token,
        });

        if (error) {
          console.error("[JoinPage] preview_invite raw error:", error);
          const { message, isOwner } = getFriendlyError(error);
          setErrorMessage(message);
          setIsOwnerError(isOwner);
        } else if (data) {
          setPreview(data as InvitePreview);
        } else {
          setErrorMessage("Something went wrong. Please try again.");
        }
      } catch (err: unknown) {
        console.error("[JoinPage] preview_invite exception:", err);
        const { message, isOwner } = getFriendlyError(err);
        setErrorMessage(message);
        setIsOwnerError(isOwner);
      } finally {
        setCheckingAuth(false);
      }
    }

    init();
  }, [token]);

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setErrorMessage("");
    const supabase = createClient();

    // Rule 2: Keep the token through Google sign-in via a safe relative "next" param (only paths starting with /join/)
    const nextPath = `/join/${token}`;
    const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (error) {
      console.error("[JoinPage] Google sign-in error:", error);
      setErrorMessage("Could not connect to Google. Please try again.");
      setSubmitting(false);
    }
  };

  const handleConfirmAndJoin = async () => {
    if (!consentChecked) return;

    setSubmitting(true);
    setErrorMessage("");
    const supabase = createClient();

    // Rule 6: Console-log whether a user exists before claim_invite call
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    console.log("[JoinPage] Pre-claim_invite auth check - User exists:", !!currentUser, currentUser ? currentUser.id : "none");

    if (!currentUser) {
      setErrorMessage("You must be signed in to join. Please continue with Google.");
      setSubmitting(false);
      return;
    }

    try {
      console.log("[JoinPage] Calling claim_invite for token:", token);
      const { error } = await supabase.rpc("claim_invite", {
        p_token: token,
      });

      if (error) {
        console.error("[JoinPage] claim_invite raw error:", error);
        const { message, isOwner } = getFriendlyError(error);
        setErrorMessage(message);
        setIsOwnerError(isOwner);
        setSubmitting(false);
        return;
      }

      router.push("/me");
    } catch (err: unknown) {
      console.error("[JoinPage] claim_invite exception:", err);
      const { message, isOwner } = getFriendlyError(err);
      setErrorMessage(message);
      setIsOwnerError(isOwner);
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setPreview(null);
    setErrorMessage("");
    setIsOwnerError(false);
    router.refresh();
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-slate-600 font-medium text-xs">Loading invitation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Logo */}
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-md">
            <Building2 className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          PGDesk Tenant Portal
        </h2>
        <p className="mt-1 text-center text-xs text-slate-600">
          Your digital stay companion
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-sm border border-slate-200 rounded-3xl space-y-5">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs font-medium space-y-2">
              <div className="flex items-start gap-2 font-bold text-red-900">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>Invite Notice</span>
              </div>
              <p className="leading-relaxed">{errorMessage}</p>

              {/* Rule 4: If owner error, show message plus "Sign out and use another account" button */}
              {isOwnerError ? (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out and use another account</span>
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-red-700/80 pt-0.5 font-semibold">
                  Hint: Ask your PG owner for a new invite QR code or link.
                </p>
              )}
            </div>
          )}

          {/* Rule 1: No user: show "You've been invited" with "Continue with Google" and make NO RPC call */}
          {!user && (
            <div className="space-y-5 text-center">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  You&apos;ve been invited to your PG on PGDesk
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Sign in with Google to confirm your stay details and view your room information.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm transition shadow-xs disabled:opacity-60"
              >
                <Chrome className="w-5 h-5 text-blue-500" />
                <span>{submitting ? "Redirecting to Google..." : "Continue with Google"}</span>
              </button>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-[11px] text-slate-600 text-left">
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <span>
                  Your data is protected. Only you and your PG management have access to your stay records.
                </span>
              </div>
            </div>
          )}

          {/* User authenticated + valid preview loaded: Confirmation Card */}
          {user && preview && !errorMessage && (
            <div className="space-y-5">
              <div className="text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                  Confirm Your Stay
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-2">
                  Is this you?
                </h3>
                <p className="text-xs text-slate-500">
                  Please review your assigned room details below before confirming.
                </p>
              </div>

              {/* Stay preview details */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">PG Property</span>
                  <span className="font-bold text-slate-900">{preview.pg_name}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Resident Name</span>
                  <span className="font-bold text-slate-900">{preview.tenant_name}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Room Number</span>
                  <span className="font-bold text-slate-900">{preview.room}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Assigned Bed</span>
                  <span className="font-bold text-teal-700">{preview.bed}</span>
                </div>
              </div>

              {/* Consent Checkbox */}
              <div className="p-3.5 bg-teal-50/50 border border-teal-200 rounded-2xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed font-medium">
                    I agree to PGDesk and my PG storing my details for stay management. (Final wording to be reviewed by a lawyer.)
                  </span>
                </label>
              </div>

              {/* Confirm and Join button */}
              <button
                type="button"
                onClick={handleConfirmAndJoin}
                disabled={!consentChecked || submitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition shadow-sm disabled:opacity-40"
              >
                <span>{submitting ? "Joining..." : "Confirm and join"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Rule 5: Add a "Sign out" link on the join page when user is logged in */}
          {user && (
            <div className="pt-2 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={handleSignOut}
                className="text-xs text-slate-500 hover:text-red-600 font-semibold transition inline-flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out ({user.email || "current account"})</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
