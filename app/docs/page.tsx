"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

const CONTRACTS = [
  {
    role: "Launchpad Factory",
    address: "0x50f204b46aE76cee395c238193127e58aa1D1f46",
    description: "Master factory deploying gas-optimized EIP-1167 Minimal Proxy clones with pre-set metadata URIs."
  },
  {
    role: "Master Implementation",
    address: "0xBC5bE44D2BA497c8dD07Ca382252b882CBee569e",
    description: "Upgradeable ERC-721A collection template with ERC-2981 secondary royalties and Merkle verification."
  },
  {
    role: "Marketplace Hub",
    address: "0x0ed8FF48787b45503d77939E33d9CF8E52f88a2D",
    description: "High-frequency trading contract supporting single/batch floor sweeps, escrow bidding, and royalty splits."
  }
];

export default function DocsPage() {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    toast.success(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-24">
      {/* Header Banner */}
      <div className="relative overflow-hidden border-b border-gray-800 bg-[#0a0a0a]">
        <div className="absolute top-0 right-1/4 w-[600px] h-[300px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-[1400px] mx-auto px-6 py-16 relative z-10">
          <span className="text-xs font-mono uppercase bg-blue-900/40 text-blue-400 border border-blue-800/60 px-3 py-1 rounded-full">
            Developer & Protocol Documentation
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white mt-4 tracking-tight">
            BasedRick Documentation
          </h1>
          <p className="text-gray-400 text-sm sm:text-base mt-2 max-w-2xl">
            Zero-code launchpad and high-frequency trading infrastructure built natively on the Base network.
          </p>

          <div className="flex flex-wrap gap-4 mt-6">
            <a
              href="https://github.com/Ricks0ne/BasedRick-Studio"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-bold rounded-xl transition flex items-center gap-2"
            >
              <span>GitHub Repo</span> ↗
            </a>
            <a
              href="https://x.com/BasedRickStudio"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold rounded-xl transition flex items-center gap-2"
            >
              <span>Official X</span> ↗
            </a>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-[1400px] mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-4 gap-10">
        
        {/* Sticky Table of Contents */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-28 bg-[#0f0f0f] border border-gray-800/80 rounded-2xl p-5 space-y-2">
            <p className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3">Navigation</p>
            <a href="#overview" className="block text-sm text-gray-400 hover:text-blue-400 transition py-1">
              1. Architecture & Overview
            </a>
            <a href="#contracts" className="block text-sm text-gray-400 hover:text-blue-400 transition py-1">
              2. Smart Contracts
            </a>
            <a href="#sweeper" className="block text-sm text-gray-400 hover:text-blue-400 transition py-1">
              3. Floor Sweeper Engine
            </a>
            <a href="#env" className="block text-sm text-gray-400 hover:text-blue-400 transition py-1">
              4. Environment Setup
            </a>
            <a href="#community" className="block text-sm text-gray-400 hover:text-blue-400 transition py-1">
              5. Official Links
            </a>
          </div>
        </div>

        {/* Documentation Sections */}
        <div className="lg:col-span-3 space-y-16">
          
          {/* Section 1: Overview */}
          <section id="overview" className="space-y-6">
            <div className="border-b border-gray-800 pb-4">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <span className="text-blue-400">#</span> Protocol Architecture
              </h2>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              BasedRick Studio is designed to bridge the gap between low-level EVM smart contract logic and frictionless creator tooling. 
              The protocol eliminates creator friction by orchestrating IPFS pinning and on-chain contract deployments into a single wallet signature, 
              paired with a pro-tier marketplace suite.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl">
                <div className="w-10 h-10 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center font-bold text-lg mb-4">
                  🎨
                </div>
                <h3 className="font-bold text-white text-base mb-1">Zero-Code Studio</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Dual-engine deployment supporting Custom Art uploads and an AI Generation Matrix. Handles automated IPFS bundling and immutable ERC-721A cloning in a single transaction.
                </p>
              </div>

              <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl">
                <div className="w-10 h-10 bg-purple-600/20 text-purple-400 rounded-xl flex items-center justify-center font-bold text-lg mb-4">
                  ⚡
                </div>
                <h3 className="font-bold text-white text-base mb-1">High-Frequency Marketplace</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Decentralized trading engine featuring single-signature batch sweeping (<code className="text-purple-400">buyBatch</code>), non-custodial bidirectional escrow, and instant public RPC multicalled queries.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Smart Contracts */}
          <section id="contracts" className="space-y-6">
            <div className="border-b border-gray-800 pb-4">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <span className="text-blue-400">#</span> Smart Contract Deployments
              </h2>
              <p className="text-xs text-gray-500 mt-1 font-mono">Network: Base Sepolia (Chain ID: 84532)</p>
            </div>

            <div className="space-y-4">
              {CONTRACTS.map((contract) => (
                <div key={contract.address} className="bg-[#121212] border border-gray-800 rounded-2xl p-6 transition hover:border-gray-700">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h3 className="font-bold text-white text-base">{contract.role}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(contract.address, contract.role)}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs font-mono rounded-lg border border-gray-700 transition flex items-center gap-1.5"
                      >
                        <span>{copiedAddress === contract.address ? "✓ Copied" : "Copy"}</span>
                      </button>
                      <a
                        href={`https://sepolia.basescan.org/address/${contract.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 text-xs font-mono rounded-lg border border-blue-800/50 transition"
                      >
                        BaseScan ↗
                      </a>
                    </div>
                  </div>
                  <p className="font-mono text-xs text-blue-400 break-all bg-black/60 px-3 py-2 rounded-lg border border-gray-800/80 mb-3">
                    {contract.address}
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">{contract.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Sweeper Engine */}
          <section id="sweeper" className="space-y-6">
            <div className="border-b border-gray-800 pb-4">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <span className="text-blue-400">#</span> Floor Sweeper Engine
              </h2>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Standard marketplace architectures require separate transaction approvals for each token purchased. BasedRick Marketplace uses an atomic <code className="text-blue-400 font-mono">buyBatch</code> function to execute multi-token purchases within a single block.
            </p>

            <div className="bg-[#0f0f0f] border border-gray-800 rounded-2xl p-5">
              <p className="text-xs uppercase font-bold text-gray-500 mb-2">Solidity Interface</p>
              <pre className="bg-black p-4 rounded-xl text-xs font-mono text-gray-300 overflow-x-auto border border-gray-800/60">
{`function buyBatch(
    address nftAddress, 
    uint256[] calldata tokenIds
) external payable nonReentrant;`}
              </pre>
            </div>
          </section>

          {/* Section 4: Environment Variables */}
          <section id="env" className="space-y-6">
            <div className="border-b border-gray-800 pb-4">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <span className="text-blue-400">#</span> Environment Setup
              </h2>
            </div>
            <p className="text-gray-300 text-sm">
              Configure your local development environment by adding these environment variables to your <code className="text-blue-400 font-mono">.env.local</code> file:
            </p>

            <div className="bg-[#0f0f0f] border border-gray-800 rounded-2xl p-5 relative">
              <button
                onClick={() =>
                  copyToClipboard(
`NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_LAUNCHPAD_FACTORY_ADDRESS="0x50f204b46aE76cee395c238193127e58aa1D1f46"
NEXT_PUBLIC_MASTER_IMPLEMENTATION_ADDRESS="0xBC5bE44D2BA497c8dD07Ca382252b882CBee569e"
NEXT_PUBLIC_MARKETPLACE_ADDRESS="0x0ed8FF48787b45503d77939E33d9CF8E52f88a2D"
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your_walletconnect_id"
PINATA_JWT="your_pinata_jwt"`,
                    "Env Variables"
                  )
                }
                className="absolute top-4 right-4 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs font-mono rounded-lg border border-gray-700 text-gray-300 transition"
              >
                Copy .env
              </button>
              <pre className="bg-black p-4 rounded-xl text-xs font-mono text-gray-300 overflow-x-auto border border-gray-800/60 leading-loose">
{`NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_LAUNCHPAD_FACTORY_ADDRESS="0x50f204b46aE76cee395c238193127e58aa1D1f46"
NEXT_PUBLIC_MASTER_IMPLEMENTATION_ADDRESS="0xBC5bE44D2BA497c8dD07Ca382252b882CBee569e"
NEXT_PUBLIC_MARKETPLACE_ADDRESS="0x0ed8FF48787b45503d77939E33d9CF8E52f88a2D"
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your_walletconnect_id"
PINATA_JWT="your_pinata_jwt"`}
              </pre>
            </div>
          </section>

          {/* Section 5: Official Links */}
          <section id="community" className="space-y-6">
            <div className="border-b border-gray-800 pb-4">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <span className="text-blue-400">#</span> Official Links & Community
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href="https://basedrick-studio.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="bg-[#111] hover:bg-gray-900 border border-gray-800 hover:border-gray-700 p-5 rounded-2xl transition flex justify-between items-center"
              >
                <div>
                  <p className="text-xs uppercase font-bold text-gray-500">Live DApp</p>
                  <p className="font-bold text-white text-sm">basedrick-studio.vercel.app</p>
                </div>
                <span className="text-gray-500">↗</span>
              </a>

              <a
                href="https://github.com/Ricks0ne/BasedRick-Studio"
                target="_blank"
                rel="noreferrer"
                className="bg-[#111] hover:bg-gray-900 border border-gray-800 hover:border-gray-700 p-5 rounded-2xl transition flex justify-between items-center"
              >
                <div>
                  <p className="text-xs uppercase font-bold text-gray-500">Source Code</p>
                  <p className="font-bold text-white text-sm">GitHub Repository</p>
                </div>
                <span className="text-gray-500">↗</span>
              </a>

              <a
                href="https://x.com/BasedRickStudio"
                target="_blank"
                rel="noreferrer"
                className="bg-[#111] hover:bg-gray-900 border border-gray-800 hover:border-gray-700 p-5 rounded-2xl transition flex justify-between items-center"
              >
                <div>
                  <p className="text-xs uppercase font-bold text-gray-500">Community</p>
                  <p className="font-bold text-white text-sm">@BasedRickStudio</p>
                </div>
                <span className="text-gray-500">↗</span>
              </a>

              <a
                href="https://x.com/ricks0x"
                target="_blank"
                rel="noreferrer"
                className="bg-[#111] hover:bg-gray-900 border border-gray-800 hover:border-gray-700 p-5 rounded-2xl transition flex justify-between items-center"
              >
                <div>
                  <p className="text-xs uppercase font-bold text-gray-500">Lead Developer</p>
                  <p className="font-bold text-white text-sm">@ricks0x</p>
                </div>
                <span className="text-gray-500">↗</span>
              </a>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}