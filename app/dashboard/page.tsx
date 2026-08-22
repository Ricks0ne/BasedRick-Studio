"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { formatEther } from "viem";
import toast from "react-hot-toast";
import { LAUNCHPAD_FACTORY_ABI, BASEDRICK_LAUNCHPAD_ABI } from "@/abi";

const FACTORY_ADDRESS = "0x253FC033d3639A2d1df017685dB4837aC8C34a2B" as `0x${string}`;
const FACTORY_DEPLOY_BLOCK = 45796720n;
const CHUNK_SIZE = 2000n;

interface CreatorCollection {
  address: string;
  name: string;
  symbol: string;
  totalSupply: number;
  maxSupply: number;
  balance: bigint;
}

export default function CreatorDashboardPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [collections, setCollections] = useState<CreatorCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchCreatorData = async () => {
      if (!address || !publicClient) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const startBlock = FACTORY_DEPLOY_BLOCK > currentBlock ? currentBlock : FACTORY_DEPLOY_BLOCK;
        
        // 1. Scan Factory for all deployed collections (Safely chunked)
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

        const deployedAddresses = Array.from(new Set(allLogs.map(log => log.args.collectionAddress as `0x${string}`)));

        if (deployedAddresses.length === 0) {
          setCollections([]);
          setIsLoading(false);
          return;
        }

        // 2. Identify which collections actually belong to the connected wallet
        const ownerCalls = deployedAddresses.map(addr => ({
          address: addr,
          abi: BASEDRICK_LAUNCHPAD_ABI,
          functionName: "owner"
        }));

        const ownerResults = await publicClient.multicall({ contracts: ownerCalls });
        
        const userCollections = deployedAddresses.filter((_, index) => {
          const res = ownerResults[index];
          return res.status === "success" && (res.result as string).toLowerCase() === address.toLowerCase();
        });

        if (userCollections.length === 0) {
          setCollections([]);
          setIsLoading(false);
          return;
        }

        // 3. Fetch detailed stats for the user's collections
        const detailsCalls = [];
        for (const addr of userCollections) {
          detailsCalls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "name" });
          detailsCalls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "symbol" });
          detailsCalls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "totalSupply" });
          detailsCalls.push({ address: addr, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "maxSupply" });
        }

        const detailsResults = await publicClient.multicall({ contracts: detailsCalls });
        
        // Fetch ETH balances natively
        const balances = await Promise.all(
          userCollections.map(addr => publicClient.getBalance({ address: addr }))
        );

        const loaded: CreatorCollection[] = [];
        for (let i = 0; i < userCollections.length; i++) {
          const offset = i * 4;
          loaded.push({
            address: userCollections[i],
            name: detailsResults[offset].status === "success" ? detailsResults[offset].result as string : "Unknown",
            symbol: detailsResults[offset + 1].status === "success" ? detailsResults[offset + 1].result as string : "---",
            totalSupply: detailsResults[offset + 2].status === "success" ? Number(detailsResults[offset + 2].result) : 0,
            maxSupply: detailsResults[offset + 3].status === "success" ? Number(detailsResults[offset + 3].result) : 0,
            balance: balances[i],
          });
        }

        setCollections(loaded.reverse());
      } catch (err) {
        console.error("Failed to fetch creator dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCreatorData();
  }, [address, publicClient, refreshTrigger]);

  const handleWithdraw = async (collectionAddress: string, collectionName: string) => {
    try {
      const hash = await writeContractAsync({
        address: collectionAddress as `0x${string}`,
        abi: BASEDRICK_LAUNCHPAD_ABI,
        functionName: "withdraw",
      });
      
      await toast.promise(
        publicClient!.waitForTransactionReceipt({ hash }),
        {
          loading: `Withdrawing funds from ${collectionName}...`,
          success: '✅ Funds transferred securely to your wallet!',
          error: 'Withdrawal failed.',
        }
      );
      
      setRefreshTrigger(prev => prev + 1); // Refresh balances
    } catch (err: any) { 
      toast.error(err?.shortMessage || err?.message || "Withdrawal rejected."); 
    }
  };

  // --- Aggregated Analytics ---
  const totalCollections = collections.length;
  const totalMinted = collections.reduce((acc, curr) => acc + curr.totalSupply, 0);
  const totalPendingRevenue = collections.reduce((acc, curr) => acc + curr.balance, BigInt(0));

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-24">
      
      {/* COMMAND CENTER HEADER */}
      <div className="relative overflow-hidden border-b border-gray-800 bg-[#0a0a0a]">
        <div className="absolute top-0 right-1/4 w-[600px] h-[300px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="max-w-[1600px] mx-auto px-6 py-16 relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">Creator Dashboard</h1>
            <p className="text-gray-400 font-mono text-sm flex items-center gap-2">
              {isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  Managing collections for {address?.slice(0,6)}...{address?.slice(-4)}
                </>
              ) : (
                "Please connect your wallet to view your creator analytics."
              )}
            </p>
          </div>

          {isConnected && (
            <div className="flex flex-wrap gap-4 md:gap-6">
              <div className="bg-[#111] border border-gray-800 rounded-2xl px-6 py-5 shadow-xl min-w-[180px]">
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Total Mints</p>
                <p className="text-3xl font-black text-white">{totalMinted}</p>
              </div>
              <div className="bg-[#111] border border-amber-900/30 rounded-2xl px-6 py-5 shadow-xl min-w-[200px] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 blur-xl rounded-full"></div>
                <p className="text-[10px] uppercase font-bold text-amber-500 tracking-wider mb-1 relative z-10">Pending Revenue</p>
                <p className="text-3xl font-black text-amber-400 relative z-10">
                  {formatEther(totalPendingRevenue)} <span className="text-sm font-bold text-amber-600">ETH</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* WORKSPACE AREA */}
      <div className="max-w-[1600px] mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <span>🗂️</span> My Deployed Contracts
          </h2>
          <Link href="/launchpad/create" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg shadow-lg transition">
            + New Drop
          </Link>
        </div>

        {!isConnected ? (
          <div className="py-24 text-center bg-[#0f0f0f] border border-gray-800 rounded-3xl max-w-2xl mx-auto">
            <span className="text-5xl block mb-4 opacity-50">🔒</span>
            <h3 className="text-xl font-bold text-white mb-2">Unauthorized Access</h3>
            <p className="text-sm text-gray-500">Connect your wallet to access your creator permissions.</p>
          </div>
        ) : isLoading ? (
          <div className="py-32 flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Compiling Analytics...</p>
          </div>
        ) : collections.length === 0 ? (
          <div className="py-24 text-center bg-[#0f0f0f] border border-gray-800 rounded-3xl max-w-2xl mx-auto">
            <span className="text-5xl block mb-4 opacity-50">🏗️</span>
            <h3 className="text-xl font-bold text-white mb-2">No Contracts Deployed</h3>
            <p className="text-sm text-gray-500 mb-6">You haven't launched any NFT collections yet.</p>
            <Link href="/launchpad/create" className="px-8 py-3 bg-blue-600 hover:bg-blue-500 font-black text-sm rounded-xl shadow-lg transition">
              Open Creator Studio
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {collections.map((collection) => {
              const mintPercentage = collection.maxSupply > 0 
                ? (collection.totalSupply / collection.maxSupply) * 100 
                : 0;

              return (
                <div key={collection.address} className="bg-[#121212] border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition flex flex-col shadow-lg">
                  
                  {/* Card Header */}
                  <div className="p-6 border-b border-gray-800/60 bg-[#161616]">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-black text-xl text-white truncate pr-4">{collection.name}</h3>
                      <span className="bg-gray-900 border border-gray-700 text-gray-300 text-[10px] font-black uppercase px-2.5 py-1 rounded">
                        {collection.symbol}
                      </span>
                    </div>
                    <a href={`https://sepolia.basescan.org/address/${collection.address}`} target="_blank" rel="noreferrer" className="text-xs font-mono text-blue-400 hover:text-blue-300 transition">
                      {collection.address.slice(0,8)}...{collection.address.slice(-6)} ↗
                    </a>
                  </div>

                  {/* Progress & Stats */}
                  <div className="p-6 flex-1 flex flex-col gap-6">
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-[10px] uppercase font-bold text-gray-500">Mint Progress</span>
                        <span className="text-sm font-black text-white">{collection.totalSupply} <span className="text-gray-500 font-normal">/ {collection.maxSupply}</span></span>
                      </div>
                      <div className="w-full bg-gray-900 rounded-full h-2.5 border border-gray-800 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full" style={{ width: `${mintPercentage}%` }}></div>
                      </div>
                    </div>

                    <div className="bg-black border border-gray-800 rounded-xl p-4 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-500 mb-0.5">Contract Treasury</p>
                        <p className="text-lg font-black text-amber-400">{formatEther(collection.balance)} ETH</p>
                      </div>
                      <button 
                        onClick={() => handleWithdraw(collection.address, collection.name)}
                        disabled={collection.balance === 0n}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                          collection.balance > 0n 
                            ? "bg-amber-600/20 text-amber-400 hover:bg-amber-500 hover:text-black border border-amber-600/30" 
                            : "bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed"
                        }`}
                      >
                        Withdraw
                      </button>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-4 border-t border-gray-800/60 bg-[#0f0f0f]">
                    <Link 
                      href={`/launchpad/${collection.address}`} 
                      className="block w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-center text-xs font-bold text-white rounded-lg transition"
                    >
                      Manage Metadata & Schedule →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}