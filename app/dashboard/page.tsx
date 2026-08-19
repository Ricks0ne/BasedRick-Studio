"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { LAUNCHPAD_FACTORY_ABI } from "@/abi";

const FACTORY_ADDRESS = "0x66E16D8B540Ad20834b6f0a8115C8C039353F5bE" as `0x${string}`;
const FACTORY_DEPLOY_BLOCK = 45500000n; 
const CHUNK_SIZE = 9000n;

interface CollectionItem {
  name: string;
  address: string;
  symbol?: string;
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const fetchOnChainCollections = async () => {
      if (!address || !publicClient) {
        setCollections([]);
        return;
      }

      setIsSyncing(true);
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
              args: { owner: address }, 
              fromBlock: from,
              toBlock: to,
            });
            allLogs = [...allLogs, ...chunkLogs];
          } catch (chunkErr) {
            console.warn(`Skipped chunk from block ${from} to ${to}:`, chunkErr);
          }
        }

        const onChainData: CollectionItem[] = allLogs.map((log: any) => ({
          address: log.args.collectionAddress,
          name: log.args.name,
          symbol: log.args.symbol,
        }));

        const uniqueMap = new Map<string, CollectionItem>();
        onChainData.forEach((item) => {
          if (item.address && !uniqueMap.has(item.address.toLowerCase())) {
            uniqueMap.set(item.address.toLowerCase(), item);
          }
        });

        setCollections(Array.from(uniqueMap.values()).reverse());
      } catch (err) {
        console.error("Failed to sync on-chain logs:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    fetchOnChainCollections();
  }, [address, publicClient]);

  return (
    <main className="max-w-6xl mx-auto p-6 text-white">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Deployed Contracts</h2>
            {isSyncing && (
              <span className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-900/30 px-2 py-1 rounded">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-emerald-400 border-t-transparent" />
                Reading Blockchain...
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">Manage your deployed launchpad collections directly from Base.</p>
        </div>
        <Link
          href="/launchpad/create"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 font-bold text-sm rounded-xl transition"
        >
          + New Collection
        </Link>
      </div>

      {!isConnected ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-12 text-center text-gray-400">
          <p className="text-lg font-semibold">Connect your wallet to scan your on-chain deployments.</p>
        </div>
      ) : collections.length === 0 && !isSyncing ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-12 text-center text-gray-400">
          <p className="text-lg font-semibold">No collections found on-chain.</p>
          <p className="text-sm mt-1">Deploy a new collection to see it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((item, index) => (
            <div
              key={`${item.address}-${index}`}
              className="bg-gray-900/60 border border-gray-800 p-6 rounded-2xl space-y-4 hover:border-gray-600 transition relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-emerald-500" />
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-white truncate pr-2">{item.name}</h3>
                {item.symbol && (
                  <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700">
                    {item.symbol}
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-gray-400 bg-black/40 p-2 rounded border border-gray-800 break-all select-all">
                {item.address}
              </p>
              <div className="flex gap-2 pt-2 border-t border-gray-800/50 mt-2">
                <Link
                  href={`/launchpad/${item.address}`}
                  className="flex-1 text-center py-2 bg-blue-600 hover:bg-blue-500 text-xs font-bold rounded-lg transition"
                >
                  Mint Dashboard
                </Link>
                <a
                  href={`https://sepolia.basescan.org/address/${item.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-2 bg-gray-800 hover:bg-gray-700 text-xs font-semibold rounded-lg border border-gray-700 transition"
                >
                  BaseScan ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}