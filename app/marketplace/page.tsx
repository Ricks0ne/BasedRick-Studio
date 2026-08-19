"use client";

import { useState, useEffect } from "react";
import { usePublicClient, useReadContract, useWriteContract, useAccount } from "wagmi";
import { formatEther } from "viem";
import Link from "next/link";
import toast from "react-hot-toast";
import { MARKETPLACE_ABI, MARKETPLACE_ADDRESS } from "@/abi";

// We'll define a mock interface for a Listing until we connect the full indexer
interface Listing {
  nftAddress: string;
  tokenId: number;
  seller: string;
  price: bigint;
  isActive: boolean;
}

export default function MarketplaceDiscovery() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  
  const [activeListings, setActiveListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // In a real production app, this data would come from a backend indexer.
  // For this MVP, we'll simulate fetching a few recent listings.
  useEffect(() => {
    // This is a placeholder for actual contract event fetching
    const fetchListings = async () => {
      setIsLoading(true);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data for UI development
      setActiveListings([
        {
          nftAddress: "0x1234...abcd",
          tokenId: 1,
          seller: "0xMockSellerA",
          price: BigInt(50000000000000000), // 0.05 ETH
          isActive: true
        },
         {
          nftAddress: "0x5678...efgh",
          tokenId: 42,
          seller: "0xMockSellerB",
          price: BigInt(150000000000000000), // 0.15 ETH
          isActive: true
        }
      ]);
      setIsLoading(false);
    };

    fetchListings();
  }, []);

  const handleBuy = async (listing: Listing) => {
    if (!isConnected) {
      toast.error("Please connect your wallet to purchase.");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "buyListing",
        args: [listing.nftAddress, BigInt(listing.tokenId)],
        value: listing.price,
      });

      await toast.promise(
        publicClient.waitForTransactionReceipt({ hash }),
        {
          loading: 'Confirming purchase on Base...',
          success: '🎉 Purchase successful!',
          error: 'Transaction failed.',
        }
      );
      
      // Remove listing from UI
      setActiveListings(prev => prev.filter(l => l.tokenId !== listing.tokenId));
      
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || "Purchase rejected.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 text-white">
      <div className="flex justify-between items-end mb-12 border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-4xl font-black text-white">Discovery</h1>
          <p className="text-gray-400 mt-2">Explore and trade the latest AI collections.</p>
        </div>
        
        {/* Placeholder for future global stats */}
        <div className="flex gap-6 text-right">
            <div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">24h Volume</p>
                <p className="text-xl font-bold text-blue-400">--- ETH</p>
            </div>
             <div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Active Listings</p>
                <p className="text-xl font-bold text-purple-400">{activeListings.length}</p>
            </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : activeListings.length === 0 ? (
        <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800">
          <p className="text-xl text-gray-500 font-semibold">No active listings found.</p>
          <p className="text-sm text-gray-600 mt-2">Be the first to list an NFT!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {activeListings.map((listing) => (
            <div key={`${listing.nftAddress}-${listing.tokenId}`} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden hover:border-blue-500 transition-colors group flex flex-col">
              
              {/* Mock Image Placeholder */}
              <div className="aspect-square bg-gray-950 flex items-center justify-center relative">
                 <span className="text-gray-700 font-mono text-sm">Image Loading...</span>
                 <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-gray-700">
                    <span className="text-xs font-bold text-white">#{listing.tokenId}</span>
                 </div>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-gray-200">Collection Name</h3>
                        <p className="text-[10px] text-gray-500 font-mono mt-1">Seller: {listing.seller.substring(0,6)}...</p>
                    </div>
                </div>
                
                <div className="mt-auto pt-4 border-t border-gray-800 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase text-gray-500 font-bold mb-0.5">Price</p>
                        <p className="text-lg font-black text-white">{formatEther(listing.price)} ETH</p>
                    </div>
                    
                    <button 
                        onClick={() => handleBuy(listing)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition"
                    >
                        Buy Now
                    </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}