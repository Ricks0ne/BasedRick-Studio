"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePublicClient } from "wagmi";
import { LAUNCHPAD_FACTORY_ABI, BASEDRICK_LAUNCHPAD_ABI } from "@/abi";
import BetaGate from "@/components/BetaGate";

const FACTORY_ADDRESS = "0x253FC033d3639A2d1df017685dB4837aC8C34a2B" as `0x${string}`;
const FACTORY_DEPLOY_BLOCK = 45796720n;
// ⚡ ADDED: Chunk size constraint
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

export default function MarketplaceHubPage() {
  const publicClient = usePublicClient();
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "live">("all");

  const resolveIpfs = (url?: string) => {
    if (!url) return "";
    return url.startsWith("ipfs://") ? url.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/") : url;
  };

  useEffect(() => {
    const fetchEcosystem = async () => {
      if (!publicClient) return;
      setIsLoading(true);
      
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const startBlock = FACTORY_DEPLOY_BLOCK > currentBlock ? currentBlock : FACTORY_DEPLOY_BLOCK;
        
        // ⚡ NEW: Safe block chunking loop to bypass the 10k RPC limit
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
            console.warn(`Failed to fetch logs from block ${from} to ${to}`);
          }
        }

        const addresses = Array.from(new Set(allLogs.map(log => log.args.collectionAddress as `0x${string}`)));

        if (addresses.length === 0) {
          setCollections([]);
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
          calls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "tokenURI", args: [1n] }); // Fetch Token #1 for Cover
        }

        const results = await publicClient.multicall({ contracts: calls });
        
        const loadedCollections: CollectionData[] = [];
        
        for (let i = 0; i < addresses.length; i++) {
          const offset = i * 6;
          const name = results[offset].status === "success" ? results[offset].result as string : "Unknown";
          const symbol = results[offset + 1].status === "success" ? results[offset + 1].result as string : "???";
          const totalSupply = results[offset + 2].status === "success" ? Number(results[offset + 2].result) : 0;
          const maxSupply = results[offset + 3].status === "success" ? Number(results[offset + 3].result) : 0;
          const isLive = results[offset + 4].status === "success" ? results[offset + 4].result as boolean : false;
          const uri = results[offset + 5].status === "success" ? results[offset + 5].result as string : null;

          let coverImage = "";
          if (uri) {
             try {
                // Background fetch for the cover image
                fetch(resolveIpfs(uri)).then(r => r.json()).then(meta => {
                   if (meta.image) {
                     setCollections(prev => prev.map(c => c.address === addresses[i] ? { ...c, coverImage: resolveIpfs(meta.image) } : c));
                   }
                }).catch(() => {});
             } catch (e) {}
          }

          loadedCollections.push({
            address: addresses[i],
            name,
            symbol,
            totalSupply,
            maxSupply,
            isLive,
            coverImage
          });
        }

        setCollections(loadedCollections.reverse());
      } catch (error) {
        console.error("Failed to fetch ecosystem collections", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEcosystem();
  }, [publicClient]);

  const displayCollections = filter === "live" ? collections.filter(c => c.isLive) : collections;
  
  const totalEcosystemItems = collections.reduce((sum, c) => sum + c.totalSupply, 0);

  return (
    <BetaGate>
      <div className="min-h-screen bg-[#050505] text-white font-sans pb-24">
        
        {/* HERO SECTION */}
        <div className="relative overflow-hidden border-b border-gray-800 bg-[#0a0a0a]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
          
          <div className="max-w-[1600px] mx-auto px-6 py-20 relative z-10">
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight">
              Explore the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Ecosystem</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl leading-relaxed mb-12">
              Discover, mint, and trade zero-code collections deployed securely on Base Sepolia.
            </p>

            <div className="flex flex-wrap gap-6 md:gap-12">
               <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 min-w-[200px] shadow-xl">
                  <p className="text-xs uppercase text-gray-500 font-bold tracking-widest mb-2">Total Collections</p>
                  <p className="text-4xl font-black text-white">{collections.length}</p>
               </div>
               <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 min-w-[200px] shadow-xl">
                  <p className="text-xs uppercase text-gray-500 font-bold tracking-widest mb-2">Total Mints</p>
                  <p className="text-4xl font-black text-blue-400">{totalEcosystemItems}</p>
               </div>
            </div>
          </div>
        </div>

        {/* WORKSPACE & GRID */}
        <div className="max-w-[1600px] mx-auto px-6 py-12">
          
          {/* TOOLBAR */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex gap-2 bg-gray-900 p-1 rounded-lg border border-gray-800">
                <button 
                    onClick={() => setFilter("all")}
                    className={`px-6 py-2.5 rounded-md text-sm font-bold transition ${filter === "all" ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"}`}
                >
                    All Collections
                </button>
                <button 
                    onClick={() => setFilter("live")}
                    className={`px-6 py-2.5 rounded-md text-sm font-bold transition flex items-center gap-2 ${filter === "live" ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"}`}
                >
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span>Live Mints</span>
                </button>
            </div>
            
            <Link href="/launchpad/create" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-900/20 transition">
               + Deploy Collection
            </Link>
          </div>

          {/* GRID */}
          {isLoading ? (
             <div className="py-32 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-gray-500 font-bold tracking-widest uppercase">Scanning Blockchain...</p>
             </div>
          ) : displayCollections.length === 0 ? (
             <div className="py-32 text-center bg-gray-900/20 border border-gray-800/50 rounded-3xl">
                <span className="text-5xl block mb-4 opacity-50">🛰️</span>
                <p className="text-xl font-bold text-gray-300">No collections found.</p>
                <p className="text-sm text-gray-500 mt-2">Be the first to deploy on the network.</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {displayCollections.map((collection) => (
                 <Link 
                   href={`/marketplace/${collection.address}`} 
                   key={collection.address}
                   className="bg-[#121212] border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-500 transition group flex flex-col relative shadow-lg hover:shadow-2xl"
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
                           <span className="bg-green-500/20 text-green-400 border border-green-500/50 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
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
                          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition">
                             →
                          </div>
                       </div>
                    </div>
                 </Link>
               ))}
             </div>
          )}
        </div>
      </div>
    </BetaGate>
  );
}