"use client";

import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  X,
  QrCode,
  Copy,
  Check,
  Share2,
  Download,
  AlertCircle,
  Clock,
} from "lucide-react";

interface InviteModalProps {
  isOpen: boolean;
  token: string | null;
  tenantName: string;
  pgName: string;
  onClose: () => void;
}

export default function TenantInviteModal({
  isOpen,
  token,
  tenantName,
  pgName,
  onClose,
}: InviteModalProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const inviteUrl =
    typeof window !== "undefined" && token
      ? `${window.location.origin}/join/${token}`
      : "";

  useEffect(() => {
    if (!token || !isOpen) {
      setQrDataUrl("");
      setCopied(false);
      return;
    }

    const url = `${window.location.origin}/join/${token}`;

    QRCode.toDataURL(
      url,
      {
        width: 256,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      },
      (err, dataUrl) => {
        if (!err && dataUrl) {
          setQrDataUrl(dataUrl);
        }
      }
    );
  }, [token, isOpen]);

  if (!isOpen || !token) return null;

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const handleWhatsAppShare = () => {
    if (!inviteUrl) return;
    const message = `Hello ${tenantName},\n\nYou have been invited to view and manage your stay at ${pgName} on PGDesk. Tap the link below to join:\n\n${inviteUrl}\n\n(This invite link is valid for 7 days.)`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `PGDesk-Invite-${tenantName.replace(/\s+/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-teal-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Tenant Invite QR</h3>
              <p className="text-xs text-slate-500">{tenantName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-center">
          {/* QR Code Container */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 inline-block mx-auto shadow-inner">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Invite QR for ${tenantName}`}
                className="w-48 h-48 rounded-xl shadow-xs mx-auto"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Warning Banner: One-time token */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Shown only once</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-tight">
              This code is shown only once. Send a new invite if it is lost. Valid for 7 days.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs"
            >
              <Share2 className="w-4 h-4" />
              <span>Share on WhatsApp</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs transition"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-600" />
                    <span>Copy link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadQR}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs transition"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Download QR</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
