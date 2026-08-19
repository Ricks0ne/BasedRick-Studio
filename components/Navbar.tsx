"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Discovery", href: "/launchpad" },
    { name: "Studio", href: "/launchpad/create" },
    { name: "My Vault", href: "/profile" },
    { name: "Creator Admin", href: "/dashboard" },
  ];

  return (
    <header className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-50 border-b border-gray-900/60 mb-6">
      {/* Brand Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-xl shadow-[0_0_15px_rgba(59,130,246,0.4)]">
          🤖
        </div>
        <Link
          href="/"
          className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 hover:opacity-90 transition"
        >
          BasedRick
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-wrap items-center gap-6 font-semibold text-sm">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`transition-colors ${
                isActive
                  ? "text-white border-b-2 border-blue-400 pb-0.5"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {link.name}
            </Link>
          );
        })}
      </nav>

      {/* Wallet Connect Button */}
      <div className="flex items-center gap-4">
        <ConnectButton showBalance={false} />
      </div>
    </header>
  );
}