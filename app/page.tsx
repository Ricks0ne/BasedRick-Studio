"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePublicClient } from "wagmi";
import { LAUNCHPAD_FACTORY_ABI, BASEDRICK_LAUNCHPAD_ABI } from "@/abi";
// ⚡ IMPORT GLOBAL CACHE
import { resolveIpfsUrl, fetchMetadataWithCache } from "@/utils/ipfsCache";

const FACTORY_ADDRESS = "0x253FC033d3639A2d1df017685dB4837aC8C34a2B" as `0x${string}`;
const FACTORY_DEPLOY_BLOCK = 45796720n;
const CHUNK_SIZE = 2000n;

interface CollectionData {
  address: string;
  name: string;
  symbol: string;
  totalSupply: number;
  maxSupply: number;
  isLive: boolean;
  coverImage?: string;
}

export default function Home() {
  const publicClient = usePublicClient();
  const [trendingCollections, setTrendingCollections] = useState<CollectionData[]>([]);
  const [isLoadingTrending, setIsLoadingTrending] = useState(true);

  // ⚡ DYNAMIC TRENDING FEED (Fetches the 4 newest collections)
  useEffect(() => {
    const fetchTrending = async () => {
      if (!publicClient) return;
      setIsLoadingTrending(true);
      
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const startBlock = FACTORY_DEPLOY_BLOCK > currentBlock ? currentBlock : FACTORY_DEPLOY_BLOCK;
        
        // Chunked scanner to bypass RPC limits safely
        let allLogs: any[] = [];
        for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
          const to = from + CHUNK_SIZE - 1n > currentBlock ? currentBlock : from + CHUNK_SIZE - 1n;
          try {
            const chunkLogs = await publicClient.getContractEvents({
              address: FACTORY_ADDRESS,
              abi: LAUNCHPAD_FACTORY_ABI,
              eventName: "CollectionLaunched",
              fromBlock: from,
              toBlock: to,
            });
            allLogs = [...allLogs, ...chunkLogs];
          } catch (e) {
            console.warn(`Skipped log chunk from ${from} to ${to}`);
          }
        }

        const addresses = Array.from(new Set(allLogs.map(log => log.args.collectionAddress as `0x${string}`)));

        if (addresses.length === 0) {
          setTrendingCollections([]);
          setIsLoadingTrending(false);
          return;
        }

        // Isolate the latest 4 deployments
        const top4 = addresses.reverse().slice(0, 4);

        const calls = [];
        for (const addr of top4) {
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "name" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "symbol" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "totalSupply" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "maxSupply" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "isPublicSaleActive" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "tokenURI", args: [1n] });
        }

        const results = await publicClient.multicall({ contracts: calls });
        
        const loaded: CollectionData[] = [];
        for (let i = 0; i < top4.length; i++) {
          const offset = i * 6;
          const name = results[offset].status === "success" ? results[offset].result as string : "Unknown";
          const symbol = results[offset + 1].status === "success" ? results[offset + 1].result as string : "???";
          const totalSupply = results[offset + 2].status === "success" ? Number(results[offset + 2].result) : 0;
          const maxSupply = results[offset + 3].status === "success" ? Number(results[offset + 3].result) : 0;
          const isLive = results[offset + 4].status === "success" ? results[offset + 4].result as boolean : false;
          const uri = results[offset + 5].status === "success" ? results[offset + 5].result as string : null;

          if (uri) {
             try {
                // ⚡ IMPLEMENTED GLOBAL CACHE HERE
                fetchMetadataWithCache(uri).then(meta => {
                   if (meta && meta.image) {
                     setTrendingCollections(prev => prev.map(c => c.address === top4[i] ? { ...c, coverImage: resolveIpfsUrl(meta.image) } : c));
                   }
                }).catch(() => {});
             } catch (e) {}
          }

          loaded.push({
            address: top4[i],
            name,
            symbol,
            totalSupply,
            maxSupply,
            isLive
          });
        }

        setTrendingCollections(loaded);
      } catch (error) {
        console.error("Failed to fetch trending collections", error);
      } finally {
        setIsLoadingTrending(false);
      }
    };

    fetchTrending();
  }, [publicClient]);

  return (
      <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30 overflow-hidden relative">
        
        {/* Dynamic Background Effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

        {/* HERO SECTION */}
        <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden border-b border-gray-900">
          <div className="max-w-[1600px] mx-auto px-6 relative z-10 text-center">
            
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 border border-gray-800 text-xs font-bold text-gray-400 mb-8 uppercase tracking-widest shadow-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Secured on Base Sepolia
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white tracking-tighter mb-8 leading-tight">
              The Future of <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-400">
                AI-Native NFTs
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              BasedRick is the premier zero-code NFT studio and decentralized marketplace. Deploy custom smart contracts, manage IPFS whitelists, and trade with zero platform setup.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/marketplace" 
                className="w-full sm:w-auto px-8 py-4 bg-white text-black hover:bg-gray-200 font-black rounded-xl transition shadow-[0_0_30px_rgba(255,255,255,0.2)]"
              >
                Explore Ecosystem
              </Link>
              <Link 
                href="/launchpad/create" 
                className="w-full sm:w-auto px-8 py-4 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-black rounded-xl transition"
              >
                Open Creator Studio
              </Link>
            </div>

          </div>
        </div>

        {/* FEATURES GRID */}
        <div className="max-w-[1600px] mx-auto px-6 py-24 border-b border-gray-900 bg-[#0a0a0a] relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">Everything You Need.</h2>
            <p className="text-gray-400 text-lg">A complete, end-to-end suite for Web3 creators and high-frequency traders.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-[#111] border border-gray-800 rounded-3xl p-8 hover:border-blue-500/50 transition duration-500 shadow-xl group">
              <div className="w-14 h-14 bg-blue-900/30 border border-blue-800/50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition">
                <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Zero-Code Smart Contracts</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Deploy fully verified ERC721A smart contracts to the blockchain instantly. No Solidity required. You retain 100% ownership.
              </p>
            </div>

            <div className="bg-[#111] border border-gray-800 rounded-3xl p-8 hover:border-purple-500/50 transition duration-500 shadow-xl group">
              <div className="w-14 h-14 bg-purple-900/30 border border-purple-800/50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition">
                <svg className="w-7 h-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Native Escrow Marketplace</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Your collection is instantly tradable the second you deploy. Featuring secure escrow, active listings, and global floor sweeps.
              </p>
            </div>

            <div className="bg-[#111] border border-gray-800 rounded-3xl p-8 hover:border-amber-500/50 transition duration-500 shadow-xl group">
              <div className="w-14 h-14 bg-amber-900/30 border border-amber-800/50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Merkle Tree Whitelisting</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Secure your drops with gas-efficient, IPFS-backed Merkle roots. Control scheduling, custom pricing, and wallet limits flawlessly.
              </p>
            </div>

          </div>
        </div>

        {/* TRENDING DROPS SECTION */}
        <div className="max-w-[1600px] mx-auto px-6 py-24 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
            <div>
              <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">Trending Drops.</h2>
              <p className="text-gray-400 text-lg">The latest collections actively minting on the network.</p>
            </div>
            <Link 
              href="/marketplace" 
              className="px-6 py-3 bg-gray-900 border border-gray-800 text-white font-bold rounded-xl hover:bg-gray-800 transition shadow-lg"
            >
              View All Collections →
            </Link>
          </div>
          
          {isLoadingTrending ? (
             <div className="py-20 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
             </div>
          ) : trendingCollections.length === 0 ? (
             <div className="py-24 text-center bg-[#111] border border-gray-800 rounded-3xl">
                <span className="text-5xl block mb-4 opacity-50">🛰️</span>
                <p className="text-xl font-bold text-gray-300">No collections found.</p>
                <Link href="/launchpad/create" className="text-blue-400 hover:underline text-sm font-bold mt-2 inline-block">Deploy the first one!</Link>
             </div>
          ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
               {trendingCollections.map((collection) => (
                 <Link 
                   href={`/marketplace/${collection.address}`} 
                   key={collection.address}
                   className="bg-[#121212] border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-500 transition group flex flex-col relative shadow-xl hover:shadow-2xl"
                 >
                    <div className="aspect-[4/3] bg-black relative overflow-hidden border-b border-gray-800">
                       {collection.coverImage ? (
                          <img src={collection.coverImage} alt={collection.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
                       ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-4xl">
                              👾
                          </div>
                       )}
                       
                       <div className="absolute top-3 left-3 flex gap-2">
                         {collection.isLive && (
                           <span className="bg-green-500/20 text-green-400 border border-green-500/50 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                             <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Minting Now
                           </span>
                         )}
                       </div>
                    </div>

                    <div className="p-5">
                       <div className="flex justify-between items-start mb-4">
                          <div>
                             <h3 className="font-black text-lg text-white group-hover:text-blue-400 transition truncate">{collection.name}</h3>
                             <p className="text-xs text-gray-500 font-mono mt-1">{collection.symbol} • {collection.address.slice(0,6)}...{collection.address.slice(-4)}</p>
                          </div>
                       </div>
                       
                       <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
                          <div>
                             <p className="text-[10px] uppercase text-gray-500 font-bold mb-0.5">Supply Minted</p>
                             <p className="text-sm font-black text-gray-200">
                                {collection.totalSupply} <span className="text-gray-600 font-normal">/ {collection.maxSupply}</span>
                             </p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition shadow-inner">
                             →
                          </div>
                       </div>
                    </div>
                 </Link>
               ))}
             </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className="border-t border-gray-900 bg-[#0a0a0a] py-16 text-center relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-6 shadow-[0_0_15px_rgba(59,130,246,0.4)]">
            🤖
          </div>
          <p className="text-white text-lg font-black tracking-tight mb-2">BasedRick Protocol</p>
          <p className="text-gray-500 text-sm font-semibold tracking-wide">Secured on Base Sepolia • © 2026</p>
        </footer>

      </div>
   
  );
}