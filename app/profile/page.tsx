"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidIndianPhone } from "@/lib/utils";
import { User, Phone, CheckCircle2, AlertCircle } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      // Prefill name from Google
      setName(user.user_metadata?.full_name || user.user_metadata?.name || "");

      // Check if profile already exists
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setName(profile.full_name || user.user_metadata?.full_name || "");
        setPhone(profile.mobile || "");
      } else {
        setIsNew(true);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (!isValidIndianPhone(cleanPhone)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: user.id,
      owner_id: user.id,
      full_name: name.trim(),
      mobile: cleanPhone,
      email: user.email,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (upsertError) {
      setError("Could not save your profile. Please try again.");
    } else {
      setSuccess("Profile saved successfully!");
      if (isNew) {
        setTimeout(() => router.push("/"), 1000);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <h2 className="text-center text-2xl font-extrabold text-slate-900">
          {isNew ? "Complete Your Profile" : "Edit Your Profile"}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          {isNew
            ? "Almost there! We just need your name and mobile number."
            : "Update your contact details here."}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200 rounded-2xl">
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-5 p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-700 text-sm font-medium flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-4 h-4 text-teal-600" />
                Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Suresh Reddy"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-teal-600" />
                Mobile Number (WhatsApp) *
              </label>
              <div className="flex rounded-xl border border-slate-300 focus-within:ring-2 focus-within:ring-teal-500 overflow-hidden">
                <span className="inline-flex items-center px-3 bg-slate-100 text-slate-600 text-sm font-semibold border-r border-slate-300">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="9876543210"
                  className="flex-1 px-4 py-3 text-slate-900 text-base focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">We use this to contact you about your PG. No spam.</p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-white font-semibold bg-teal-600 hover:bg-teal-700 transition shadow-sm disabled:opacity-50 text-base"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{saving ? "Saving..." : (isNew ? "Save & Continue to Dashboard" : "Save Changes")}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
