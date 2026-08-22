"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isMobileMenuOpen]);

  // Close mobile menu automatically on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Launchpad", href: "/launchpad" },
    { name: "Marketplace", href: "/marketplace" },
    { name: "Studio", href: "/launchpad/create" },
    { name: "Portfolio", href: "/profile" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Docs", href: "/docs" }, // ⚡ NEW: Added Docs link
  ];

  return (
    <>
      {/* ⚡ STICKY TOP BAR (Accessible at all times) */}
      <header className="sticky top-0 z-40 bg-[#050505]/90 backdrop-blur-xl border-b border-gray-900/80 shadow-2xl w-full">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3 z-50">
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

          {/* ⚡ DESKTOP NAVIGATION */}
          <nav className="hidden lg:flex items-center gap-8 font-bold text-sm">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors relative py-2 ${
                    isActive
                      ? "text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {link.name}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Connect Button & Mobile Toggle */}
          <div className="flex items-center gap-4 z-50">
            <div className="hidden sm:block">
               <ConnectButton showBalance={false} />
            </div>

            {/* Mobile Menu Toggle (Hamburger / Close) */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-gray-400 hover:text-white bg-gray-900 border border-gray-800 rounded-lg transition"
            >
              {isMobileMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ⚡ MOBILE SIDE DRAWER NAVIGATION */}
      <div 
        className={`fixed inset-0 z-[100] transition-opacity duration-300 lg:hidden ${
          isMobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />

        {/* Sliding Drawer */}
        <div 
          className={`absolute top-0 right-0 h-full w-[80%] max-w-sm bg-[#0a0a0a] border-l border-gray-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out transform ${
            isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
           {/* Drawer Header */}
           <div className="p-6 border-b border-gray-900 flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-widest text-gray-500">Navigation</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-white bg-gray-900 p-2 rounded-lg border border-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
           </div>

           {/* Mobile Links */}
           <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-2">
             {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-xl font-black p-4 rounded-xl transition-colors flex items-center justify-between ${
                      isActive
                        ? "bg-blue-600/10 text-blue-400 border border-blue-500/30"
                        : "text-gray-300 hover:bg-gray-900 hover:text-white"
                    }`}
                  >
                    {link.name}
                    {isActive && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                  </Link>
                );
             })}
           </div>

           {/* Mobile Connect Button at bottom */}
           <div className="p-6 border-t border-gray-900 bg-[#050505] flex justify-center">
             <div className="w-full flex justify-center [&>div]:w-full [&>div>button]:w-full [&>div>button]:justify-center">
               <ConnectButton showBalance={false} />
             </div>
           </div>
        </div>
      </div>
    </>
  );
}