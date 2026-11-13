"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Owner } from "@/lib/types";
import { logoutOwner } from "@/lib/data/auth";
import { Building2, LogOut, User, Settings } from "lucide-react";

interface NavbarProps {
  currentOwner?: Owner | null;
  onLogout?: () => void;
}

export default function Navbar({ currentOwner, onLogout }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await logoutOwner();
    if (onLogout) {
      onLogout();
    } else {
      router.push("/auth/login");
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm group-hover:bg-teal-700 transition">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-slate-900 tracking-tight">PGDesk</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                India
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">Easy PG &amp; Hostel Management</p>
          </div>
        </Link>

        {/* User Info & Actions */}
        {currentOwner ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs sm:text-sm text-slate-700">
              <User className="w-3.5 h-3.5 text-teal-600" />
              <span className="font-medium max-w-[120px] sm:max-w-none truncate">
                {currentOwner.name}
              </span>
            </div>
            <Link
              href="/profile"
              className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-50 transition"
              title="Edit Profile"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="text-xs sm:text-sm font-medium text-slate-700 hover:text-teal-700 px-3 py-2 rounded-lg"
            >
              Login
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
