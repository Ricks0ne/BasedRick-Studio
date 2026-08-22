"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { LAUNCHPAD_FACTORY_ABI, BASEDRICK_LAUNCHPAD_ABI } from "@/abi";
import BetaGate from "@/components/BetaGate";

const FACTORY_ADDRESS = "0x253FC033d3639A2d1df017685dB4837aC8C34a2B" as `0x${string}`;
const FACTORY_DEPLOY_BLOCK = 45796720n;
const CHUNK_SIZE = 2000n;

interface DropData {
  address: string;
  name: string;
  symbol: string;
  totalSupply: number;
  maxSupply: number;
  isPublicLive: boolean;
  isWlLive: boolean;
  publicPrice: bigint;
  wlPrice: bigint;
  coverImage?: string;
}

export default function LaunchpadFeedPage() {
  const publicClient = usePublicClient();
  const [drops, setDrops] = useState<DropData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "live" | "soldout">("all");

  const resolveIpfs = (url?: string) => {
    if (!url) return "";
    return url.startsWith("ipfs://") ? url.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/") : url;
  };

  useEffect(() => {
    const fetchDrops = async () => {
      if (!publicClient) return;
      setIsLoading(true);
      
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const startBlock = FACTORY_DEPLOY_BLOCK > currentBlock ? currentBlock : FACTORY_DEPLOY_BLOCK;
        
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
          setDrops([]);
          setIsLoading(false);
          return;
        }

        const calls = [];
        for (const addr of addresses) {
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "name" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "symbol" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "totalSupply" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "maxSupply" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "isPublicSaleActive" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "isWhitelistActive" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "publicPrice" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "whitelistPrice" });
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "tokenURI", args: [1n] });
        }

        const results = await publicClient.multicall({ contracts: calls });
        
        const loaded: DropData[] = [];
        for (let i = 0; i < addresses.length; i++) {
          const offset = i * 9;
          const name = results[offset].status === "success" ? results[offset].result as string : "Unknown";
          const symbol = results[offset + 1].status === "success" ? results[offset + 1].result as string : "???";
          const totalSupply = results[offset + 2].status === "success" ? Number(results[offset + 2].result) : 0;
          const maxSupply = results[offset + 3].status === "success" ? Number(results[offset + 3].result) : 0;
          const isPublicLive = results[offset + 4].status === "success" ? results[offset + 4].result as boolean : false;
          const isWlLive = results[offset + 5].status === "success" ? results[offset + 5].result as boolean : false;
          const publicPrice = results[offset + 6].status === "success" ? results[offset + 6].result as bigint : 0n;
          const wlPrice = results[offset + 7].status === "success" ? results[offset + 7].result as bigint : 0n;
          const uri = results[offset + 8].status === "success" ? results[offset + 8].result as string : null;

          if (uri) {
             try {
                fetch(resolveIpfs(uri)).then(r => r.json()).then(meta => {
                   if (meta.image) {
                     setDrops(prev => prev.map(d => d.address === addresses[i] ? { ...d, coverImage: resolveIpfs(meta.image) } : d));
                   }
                }).catch(() => {});
             } catch (e) {}
          }

          loaded.push({
            address: addresses[i],
            name,
            symbol,
            totalSupply,
            maxSupply,
            isPublicLive,
            isWlLive,
            publicPrice,
            wlPrice
          });
        }

        setDrops(loaded.reverse());
      } catch (error) {
        console.error("Failed to fetch launchpad drops", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrops();
  }, [publicClient]);

  let displayDrops = drops;
  if (filter === "live") displayDrops = drops.filter(d => (d.isPublicLive || d.isWlLive) && d.totalSupply < d.maxSupply);
  if (filter === "soldout") displayDrops = drops.filter(d => d.totalSupply >= d.maxSupply && d.maxSupply > 0);

  return (
    <BetaGate>
      <div className="min-h-screen bg-[#050505] text-white font-sans pb-24">
        
        {/* HERO SECTION */}
        <div className="relative overflow-hidden border-b border-gray-800 bg-[#0a0a0a]">
          <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
          
          <div className="max-w-[1600px] mx-auto px-6 py-20 relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-900/30 border border-blue-500/30 text-[10px] font-bold text-blue-400 mb-4 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                Primary Market
              </div>
              <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tight">Active Drops</h1>
              <p className="text-xl text-gray-400 max-w-xl leading-relaxed">
                Be the first to mint. Discover and collect directly from verified creator smart contracts.
              </p>
            </div>
            
            <Link 
              href="/launchpad/create" 
              className="px-8 py-4 bg-white text-black font-black rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:bg-gray-200 transition text-sm whitespace-nowrap"
            >
              Deploy Your Own Drop
            </Link>
          </div>
        </div>

        {/* WORKSPACE & GRID */}
        <div className="max-w-[1600px] mx-auto px-6 py-12">
          
          {/* TOOLBAR */}
          <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
            <div className="flex gap-2 bg-gray-900 p-1 rounded-lg border border-gray-800">
                <button 
                    onClick={() => setFilter("all")}
                    className={`px-5 py-2 rounded-md text-sm font-bold transition ${filter === "all" ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"}`}
                >
                    All Drops
                </button>
                <button 
                    onClick={() => setFilter("live")}
                    className={`px-5 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${filter === "live" ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"}`}
                >
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Live Now
                </button>
                <button 
                    onClick={() => setFilter("soldout")}
                    className={`px-5 py-2 rounded-md text-sm font-bold transition ${filter === "soldout" ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"}`}
                >
                    Sold Out
                </button>
            </div>
          </div>

          {/* GRID */}
          {isLoading ? (
             <div className="py-32 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-gray-500 font-bold tracking-widest uppercase">Fetching Mint Schedules...</p>
             </div>
          ) : displayDrops.length === 0 ? (
             <div className="py-32 text-center bg-gray-900/20 border border-gray-800/50 rounded-3xl">
                <span className="text-5xl block mb-4 opacity-50">📭</span>
                <p className="text-xl font-bold text-gray-300">No drops found for this filter.</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {displayDrops.map((drop) => {
                 const isSoldOut = drop.totalSupply >= drop.maxSupply && drop.maxSupply > 0;
                 const isLive = (drop.isPublicLive || drop.isWlLive) && !isSoldOut;
                 const progressPercent = drop.maxSupply > 0 ? (drop.totalSupply / drop.maxSupply) * 100 : 0;

                 return (
                 <Link 
                   href={`/launchpad/${drop.address}`} 
                   key={drop.address}
                   className="bg-[#121212] border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-500 transition group flex flex-col relative shadow-xl hover:shadow-2xl"
                 >
                    <div className="aspect-[4/3] bg-black relative overflow-hidden border-b border-gray-800">
                       {drop.coverImage ? (
                          <img src={drop.coverImage} alt={drop.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
                       ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-4xl">
                             👾
                          </div>
                       )}
                       
                       {/* Status Badges */}
                       <div className="absolute top-3 left-3 flex flex-col gap-2">
                         {isSoldOut ? (
                           <span className="bg-red-500/20 text-red-400 border border-red-500/50 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider shadow-lg">
                             Sold Out
                           </span>
                         ) : isLive ? (
                           <span className="bg-green-500/20 text-green-400 border border-green-500/50 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                             <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Minting Now
                           </span>
                         ) : (
                           <span className="bg-gray-800/80 text-gray-300 border border-gray-600 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider shadow-lg">
                             Paused / Upcoming
                           </span>
                         )}
                         
                         {!isSoldOut && drop.isWlLive && (
                           <span className="bg-purple-500/20 text-purple-300 border border-purple-500/50 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider shadow-lg inline-block w-fit">
                             WL Active
                           </span>
                         )}
                       </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                       <div className="mb-4">
                          <h3 className="font-black text-xl text-white group-hover:text-blue-400 transition truncate">{drop.name}</h3>
                          <p className="text-xs text-gray-500 font-mono mt-1">{drop.symbol} • {drop.address.slice(0,6)}...{drop.address.slice(-4)}</p>
                       </div>
                       
                       <div className="bg-[#0a0a0a] rounded-xl p-3 border border-gray-800/60 mb-5 flex justify-between items-center">
                          <div>
                            <p className="text-[9px] uppercase font-bold text-gray-500 mb-0.5">Public Price</p>
                            <p className="text-sm font-black text-white">{formatEther(drop.publicPrice)} ETH</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] uppercase font-bold text-purple-400/70 mb-0.5">WL Price</p>
                            <p className="text-sm font-black text-purple-400">{formatEther(drop.wlPrice)} ETH</p>
                          </div>
                       </div>

                       <div className="mt-auto">
                          <div className="flex justify-between items-end mb-2">
                             <span className="text-[10px] uppercase font-bold text-gray-500">Minted</span>
                             <span className="text-xs font-black text-white">{drop.totalSupply} <span className="text-gray-500 font-normal">/ {drop.maxSupply}</span></span>
                          </div>
                          <div className="w-full bg-gray-900 rounded-full h-2 border border-gray-800 overflow-hidden mb-4">
                             <div 
                               className={`h-full rounded-full ${isSoldOut ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'}`} 
                               style={{ width: `${progressPercent}%` }}
                             ></div>
                          </div>
                          
                          <div className={`w-full py-3 text-center text-sm font-black rounded-xl transition border ${
                            isSoldOut 
                              ? 'bg-gray-900 text-gray-600 border-gray-800' 
                              : isLive
                                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
                          }`}>
                            {isSoldOut ? 'View Collection' : isLive ? 'Go to Mint →' : 'View Schedule'}
                          </div>
                       </div>
                    </div>
                 </Link>
                 )
               })}
             </div>
          )}
        </div>
      </div>
    </BetaGate>
  );
}