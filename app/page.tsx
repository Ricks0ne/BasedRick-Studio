"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500/30 overflow-hidden relative">
      {/* Dynamic Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-20 relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-950/40 border border-blue-500/30 text-blue-400 text-xs font-bold tracking-widest uppercase mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Live on Base Sepolia
        </div>

        <h1 className="text-6xl md:text-8xl font-black mb-6 leading-tight tracking-tighter">
          The Future of <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 animate-gradient-x">
            AI-Native NFTs
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
          BasedRick is a 100% on-chain, trustless launchpad. Generate prompt matrices, package ERC-721 metadata to IPFS, and deploy immutable smart contracts in seconds.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
          <Link 
            href="/launchpad"
            className="w-full sm:w-auto px-8 py-4 bg-white text-black font-black rounded-xl hover:bg-gray-200 transition shadow-[0_0_30px_rgba(255,255,255,0.2)] text-lg"
          >
            Explore Active Drops
          </Link>
          <Link 
            href="/launchpad/create"
            className="w-full sm:w-auto px-8 py-4 bg-gray-900 border border-gray-700 hover:border-gray-500 text-white font-bold rounded-xl transition text-lg flex items-center justify-center gap-2"
          >
            <span>⚡</span> Launch a Collection
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-6 py-24 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Built for Web3 Purists</h2>
          <p className="text-gray-400">Zero databases. Zero central servers. The blockchain is the backend.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 hover:border-blue-500/50 transition duration-300">
            <div className="w-14 h-14 bg-blue-950 border border-blue-800 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-inner">
              🧠
            </div>
            <h3 className="text-xl font-bold text-white mb-3">AI Generation</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Define your base prompt and let our AI engine generate unique rarity tiers, attributes, and structured JSON metadata instantly.
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 hover:border-purple-500/50 transition duration-300">
            <div className="w-14 h-14 bg-purple-950 border border-purple-800 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-inner">
              📦
            </div>
            <h3 className="text-xl font-bold text-white mb-3">IPFS Decentralization</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Your assets aren't sitting on AWS. Metadata and images are pinned directly to the InterPlanetary File System (IPFS) via Pinata.
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 hover:border-emerald-500/50 transition duration-300">
            <div className="w-14 h-14 bg-emerald-950 border border-emerald-800 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-inner">
              🛡️
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Trustless Architecture</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Powered by Cloned Proxy Contracts on Base. Enforce strict creator allocations, Merkle-tree whitelists, and time-locked mint phases.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-900 mt-12 py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center text-[10px]">
              🤖
            </div>
            <span className="font-bold text-gray-300">BasedRick Infrastructure</span>
          </div>
          <p className="text-gray-600 text-sm font-mono">
            Operating securely on the Base Network.
          </p>
        </div>
      </footer>
    </main>
  );
}