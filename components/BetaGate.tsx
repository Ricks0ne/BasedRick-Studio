"use client";

import { useState, useEffect } from "react";

export default function BetaGate({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && localStorage.getItem("basedrick_unlocked") === "true") {
      setIsUnlocked(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/verify-beta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem("basedrick_unlocked", "true");
        setIsUnlocked(true);
      } else {
        setError(data.message || "Invalid or already used access code.");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Prevent SSR hydration mismatch
  if (!mounted) return null;

  // Render children if already unlocked
  if (isUnlocked) {
    return <>{children}</>;
  }

  // Render the locked gate UI
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 backdrop-blur-md px-4">
      <div className="max-w-md w-full space-y-6 bg-zinc-900/90 border border-zinc-800 p-8 rounded-2xl shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center mx-auto text-blue-400 text-xl font-bold">
            ⚡
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            BasedRick Private Beta
          </h2>
          <p className="text-xs text-zinc-400">
            Access to the studio is currently limited. Enter your single-use invite code to unlock the platform.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all text-center tracking-widest font-mono"
              placeholder="ENTER-ACCESS-CODE"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs font-semibold text-center bg-red-950/40 border border-red-800/50 py-2 px-3 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full flex justify-center py-3 px-4 text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
          >
            {loading ? "Verifying On-Chain / Database..." : "Unlock Studio"}
          </button>
        </form>

        <div className="pt-2 text-center border-t border-zinc-800/60">
          <p className="text-[11px] text-zinc-500">
            Need a code? Check announcements in our community channels.
          </p>
        </div>
      </div>
    </div>
  );
}