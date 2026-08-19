"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { LAUNCHPAD_FACTORY_ABI, BASEDRICK_LAUNCHPAD_ABI } from "@/abi";

const FACTORY_ADDRESS = "0x66E16D8B540Ad20834b6f0a8115C8C039353F5bE" as `0x${string}`;
const FACTORY_DEPLOY_BLOCK = 45500000n; 
const CHUNK_SIZE = 9000n;

interface EnrichedCollection {
  name: string;
  symbol: string;
  address: string;
  owner: string;
  minted: number;
  maxSupply: number;
  publicPrice: string;
  isLive: boolean;
}

export default function LaunchpadDiscoveryPage() {
  const publicClient = usePublicClient();
  const [collections, setCollections] = useState<EnrichedCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchGlobalOnChainCollections = async () => {
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
          } catch (chunkErr) {}
        }

        const uniqueAddresses = new Set();
        const rawCollections = allLogs
          .reverse()
          .filter((log: any) => {
            const addr = log.args.collectionAddress.toLowerCase();
            if (uniqueAddresses.has(addr)) return false;
            uniqueAddresses.add(addr);
            return true;
          })
          .map((log: any) => ({
            address: log.args.collectionAddress,
            name: log.args.name,
            symbol: log.args.symbol,
            owner: log.args.owner,
          }));

        // Multicall for live on-chain stats
        const enrichedPromises = rawCollections.map(async (col) => {
          try {
            const stats = await publicClient.multicall({
              contracts: [
                { address: col.address as `0x${string}`, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: 'totalSupply' },
                { address: col.address as `0x${string}`, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: 'maxSupply' },
                { address: col.address as `0x${string}`, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: 'isPublicSaleActive' },
                { address: col.address as `0x${string}`, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: 'publicPrice' },
              ]
            });
            
            return {
              ...col,
              minted: stats[0].status === "success" ? Number(stats[0].result) : 0,
              maxSupply: stats[1].status === "success" ? Number(stats[1].result) : 0,
              isLive: stats[2].status === "success" ? Boolean(stats[2].result) : false,
              publicPrice: stats[3].status === "success" ? formatEther(stats[3].result as bigint) : "0",
            };
          } catch (e) {
            return { ...col, minted: 0, maxSupply: 0, isLive: false, publicPrice: "0" };
          }
        });

        const finalData = await Promise.all(enrichedPromises);
        setCollections(finalData);
      } catch (err) {
        console.error("Failed to load global collections:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGlobalOnChainCollections();
  }, [publicClient]);

  const filteredCollections = collections.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="max-w-7xl mx-auto px-4 pb-12 text-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 border border-blue-800/50 rounded-3xl p-10 mb-12 text-center relative overflow-hidden">
        <div className="absolute top-[-50%] left-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-50%] right-[-10%] w-96 h-96 bg-purple-500/20 rounded-full blur-[100px]"></div>
        
        <div className="relative z-10">
          <span className="text-sm font-bold tracking-widest text-blue-400 uppercase mb-4 block">
            The Base Sepolia Network
          </span>
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-6">
            Discover Next-Gen Drops
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
            Explore and mint AI-generated NFT collections entirely on-chain through the BasedRick Launchpad infrastructure.
          </p>
          <Link 
            href="/launchpad/create"
            className="inline-block px-8 py-4 bg-white text-black font-extrabold rounded-xl hover:bg-gray-200 transition shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            Launch Your Own Collection
          </Link>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h2 className="text-3xl font-bold text-gray-100 flex items-center gap-3">
          <span className="text-blue-500">⚡</span> Active Drops
          <span className="text-sm font-mono bg-gray-800 text-gray-400 px-3 py-1 rounded-full border border-gray-700">
            {collections.length} Total
          </span>
        </h2>

        <div className="w-full md:w-96 relative">
          <input 
            type="text" 
            placeholder="Search by name, symbol, or address..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900/80 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition"
          />
          <span className="absolute left-4 top-3 text-gray-500">🔍</span>
        </div>
      </div>

      {/* Discovery Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-blue-400 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-current border-t-transparent" />
          <p className="font-bold tracking-widest uppercase text-sm">Scanning On-Chain Analytics...</p>
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-16 text-center">
          <span className="text-6xl mb-4 block">🌌</span>
          <h3 className="text-2xl font-bold text-gray-200 mb-2">The Void is Empty</h3>
          <p className="text-gray-500">No collections matched your search or the network is quiet today.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCollections.map((col, idx) => (
            <div key={idx} className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden hover:border-blue-500/50 transition group flex flex-col shadow-xl">
              
              <div className="h-24 bg-gradient-to-r from-gray-800 to-gray-900 relative">
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                {/* Live Status Badge */}
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-gray-700">
                  <span className={`h-2 w-2 rounded-full ${col.isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-200">
                    {col.isLive ? "Live Now" : "Paused"}
                  </span>
                </div>
              </div>

              <div className="px-5 pb-6 flex-1 flex flex-col relative">
                <div className="w-16 h-16 bg-gray-950 border-4 border-gray-900 rounded-xl absolute -top-8 flex items-center justify-center text-xl font-black text-gray-500 overflow-hidden shadow-lg">
                  {col.name.charAt(0).toUpperCase()}
                </div>

                <div className="mt-10 mb-4 flex-1">
                  <h3 className="text-lg font-black text-white truncate">{col.name}</h3>
                  <div className="flex items-center gap-2 mt-1 mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-800 text-blue-400 px-2 py-0.5 rounded border border-gray-700">
                      ${col.symbol}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono truncate">
                      {col.address.slice(0, 6)}...{col.address.slice(-4)}
                    </span>
                  </div>

                  {/* Real-Time Mint Progress Bar */}
                  <div className="bg-gray-950 rounded-lg p-3 border border-gray-800">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Mint Progress</span>
                      <span className="text-xs font-mono text-gray-200">{col.minted} / {col.maxSupply || "∞"}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${col.maxSupply > 0 ? (col.minted / col.maxSupply) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-800/50">
                      <span className="text-[10px] text-gray-500 uppercase font-bold">Public Price</span>
                      <span className="text-sm font-black text-blue-400">{col.publicPrice} ETH</span>
                    </div>
                  </div>
                </div>

                <Link 
                  href={`/launchpad/${col.address}`}
                  className="w-full mt-2 block text-center py-3 bg-gray-800 group-hover:bg-blue-600 text-white font-bold rounded-xl transition duration-300"
                >
                  View Collection
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}