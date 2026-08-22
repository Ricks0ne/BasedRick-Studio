"use client";

export default function BetaGate({ children }: { children: React.ReactNode }) {
  // ⚡ BETA GATE REMOVED: The platform is now fully public!
  // This acts as a seamless pass-through to render the studio and admin pages.
  return <>{children}</>;
}