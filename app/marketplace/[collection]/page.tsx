"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAccount, useReadContracts, useWriteContract, usePublicClient } from "wagmi";
import { formatEther, parseEther } from "viem";
import toast from "react-hot-toast";
import { MARKETPLACE_ABI, MARKETPLACE_ADDRESS, BASEDRICK_LAUNCHPAD_ABI } from "@/abi";

interface NFTItem {
  tokenId: number;
  owner: string;
  name: string;
  image: string;
  tier: string;
  isListed: boolean;
  price: bigint;
}

export default function CollectionMarketplacePage() {
  const params = useParams();
  const rawAddress = params?.collection as string | undefined;
  const collectionAddress = rawAddress ? (rawAddress.startsWith("0x") ? rawAddress : `0x${rawAddress}`) as `0x${string}` : undefined;

  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [items, setItems] = useState<NFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterListed, setFilterListed] = useState(false);

  // Modal States
  const [offerModalToken, setOfferModalToken] = useState<number | null>(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerDuration, setOfferDuration] = useState<number>(86400); // Default 1 Day
  
  const [listModalToken, setListModalToken] = useState<number | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [listDuration, setListDuration] = useState<number>(604800); // Default 7 Days

  // 1. Fetch Collection Metadata
  const { data: collectionData, refetch: refetchCollection } = useReadContracts({
    contracts: collectionAddress ? [
      { address: collectionAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "name" },
      { address: collectionAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "symbol" },
      { address: collectionAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "totalSupply" },
    ] : [],
  });

  const collectionName = collectionData?.[0]?.result as string | undefined;
  const symbol = collectionData?.[1]?.result as string | undefined;
  const totalSupply = collectionData?.[2]?.result as bigint | undefined;

  // 2. Fetch all tokens and their marketplace status via Multicall
  const loadMarketplaceData = async () => {
    if (!collectionAddress || !publicClient || totalSupply === undefined) return;
    const count = Number(totalSupply);
    if (count === 0) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const calls = [];
      for (let i = 1; i <= count; i++) {
        calls.push({ address: collectionAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "tokenURI", args: [BigInt(i)] });
        calls.push({ address: collectionAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "ownerOf", args: [BigInt(i)] });
        calls.push({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: "listings", args: [collectionAddress, BigInt(i)] });
      }

      const results = await publicClient.multicall({ contracts: calls });
      
      const loadedItems: NFTItem[] = [];
      const resolveIpfs = (url: string) => url.startsWith("ipfs://") ? url.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/") : url;
      
      for (let i = 0; i < count; i++) {
        const tokenId = i + 1;
        const uriRes = results[i * 3];
        const ownerRes = results[i * 3 + 1];
        const listingRes = results[i * 3 + 2];

        const owner = ownerRes.status === "success" ? ownerRes.result as string : "Unknown";
        // Update parsing for listing struct which now includes expiresAt
        const listing = listingRes.status === "success" ? listingRes.result as [string, bigint, bigint, boolean] : null;

        const isListed = listing ? listing[3] : false;
        const price = listing && isListed ? listing[1] : BigInt(0);

        let name = `Token #${tokenId}`;
        let image = "";
        let tier = "Unknown";

        if (uriRes.status === "success" && uriRes.result) {
          try {
             const metadata = await fetch(resolveIpfs(uriRes.result as string)).then(r => r.json());
             name = metadata.name || name;
             image = resolveIpfs(metadata.image);
             const rarityAttr = metadata.attributes?.find((a: any) => a.trait_type?.toLowerCase() === "rarity tier" || a.trait_type?.toLowerCase() === "tier");
             if (rarityAttr) tier = rarityAttr.value;
          } catch (e) {
            console.error(`Metadata fetch failed for token ${tokenId}`);
          }
        }

        loadedItems.push({ tokenId, owner, name, image, tier, isListed, price });
      }

      setItems(loadedItems.reverse()); 
    } catch (err) {
      console.error("Failed to load marketplace items", err);
      toast.error("Failed to load marketplace data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMarketplaceData();
  }, [collectionAddress, totalSupply, publicClient]);

  const activeListings = items.filter(i => i.isListed);
  let floorPrice = BigInt(0);
  if (activeListings.length > 0) {
    floorPrice = activeListings.reduce((min, p) => p.price < min ? p.price : min, activeListings[0].price);
  }

  const displayItems = filterListed ? activeListings : items;

  // --- Contract Interactions ---

  const handleBuy = async (tokenId: number, price: bigint) => {
    if (!isConnected) return toast.error("Connect wallet to buy");
    try {
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "buyListing",
        args: [collectionAddress, BigInt(tokenId)],
        value: price,
      });
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), {
        loading: 'Processing purchase...',
        success: '🎉 NFT Purchased successfully!',
        error: 'Purchase failed',
      });
      loadMarketplaceData();
    } catch (err: any) {
      toast.error(err.shortMessage || "Transaction rejected");
    }
  };

  const submitOffer = async () => {
    if (!offerModalToken || !offerAmount) return;
    try {
      const value = parseEther(offerAmount);
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "makeOffer",
        // ⚡ Updated to include the duration in seconds
        args: [collectionAddress, BigInt(offerModalToken), BigInt(offerDuration)],
        value: value,
      });
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), {
        loading: 'Locking offer in escrow...',
        success: '✅ Offer placed successfully!',
        error: 'Offer failed',
      });
      setOfferModalToken(null);
      setOfferAmount("");
    } catch (err: any) {
      toast.error(err.shortMessage || "Transaction rejected");
    }
  };

  const submitListing = async () => {
    if (!listModalToken || !listPrice || !collectionAddress) return;
    try {
      const approvalHash = await writeContractAsync({
        address: collectionAddress,
        abi: BASEDRICK_LAUNCHPAD_ABI,
        functionName: "approve",
        args: [MARKETPLACE_ADDRESS, BigInt(listModalToken)],
      });
      
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash: approvalHash }), {
        loading: 'Approving marketplace...',
        success: '✅ Approved! Confirm listing...',
        error: 'Approval failed',
      });

      const priceWei = parseEther(listPrice);
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "createListing",
        // ⚡ Updated to include the duration in seconds
        args: [collectionAddress, BigInt(listModalToken), priceWei, BigInt(listDuration)],
      });

      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), {
        loading: 'Listing NFT...',
        success: '🚀 Successfully listed for sale!',
        error: 'Listing failed',
      });

      setListModalToken(null);
      setListPrice("");
      loadMarketplaceData();
    } catch (err: any) {
      toast.error(err.shortMessage || "Transaction rejected");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 text-white">
      {/* Collection Header */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-8 mb-8 backdrop-blur shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-white">
              {collectionName || "Loading Collection..."}
            </h1>
            <p className="text-gray-400 font-mono mt-2 flex items-center gap-2">
               Symbol: <span className="text-gray-200">{symbol}</span> | 
               Contract: <a href={`https://sepolia.basescan.org/address/${collectionAddress}`} target="_blank" className="text-blue-400 hover:underline">{collectionAddress?.slice(0,6)}...{collectionAddress?.slice(-4)} ↗</a>
            </p>
          </div>
          
          <div className="flex gap-6 md:gap-12 bg-gray-950/50 p-4 rounded-2xl border border-gray-800">
             <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Floor Price</p>
                <p className="text-2xl font-black text-blue-400">
                    {floorPrice > BigInt(0) ? formatEther(floorPrice) : "---"} <span className="text-sm font-bold text-gray-500">ETH</span>
                </p>
             </div>
             <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total Items</p>
                <p className="text-2xl font-black text-white">{totalSupply !== undefined ? Number(totalSupply) : "---"}</p>
             </div>
             <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Listed</p>
                <p className="text-2xl font-black text-purple-400">{activeListings.length}</p>
             </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
        <div className="flex gap-2 bg-gray-900 p-1 rounded-lg border border-gray-800">
            <button 
                onClick={() => setFilterListed(false)}
                className={`px-4 py-2 rounded-md text-sm font-bold transition ${!filterListed ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"}`}
            >
                All Items
            </button>
            <button 
                onClick={() => setFilterListed(true)}
                className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${filterListed ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"}`}
            >
                <span>Listed</span>
                <span className="bg-gray-950 px-1.5 py-0.5 rounded text-[10px]">{activeListings.length}</span>
            </button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
         <div className="py-24 flex flex-col justify-center items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-gray-500 font-mono text-sm uppercase tracking-widest animate-pulse">Syncing Blockchain Data...</p>
         </div>
      ) : displayItems.length === 0 ? (
        <div className="text-center py-24 bg-gray-900/40 rounded-3xl border border-gray-800/50">
          <span className="text-4xl mb-4 block">👻</span>
          <p className="text-xl text-gray-400 font-semibold">No items found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {displayItems.map((item) => {
            const isOwner = userAddress?.toLowerCase() === item.owner.toLowerCase();
            
            return (
            <div key={item.tokenId} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-600 transition group flex flex-col">
              <div className="aspect-square bg-gray-950 relative">
                 {item.image ? (
                     <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                 ) : (
                     <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">No Image</div>
                 )}
                 <span className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] font-black border border-gray-700 shadow-lg">
                    #{item.tokenId}
                 </span>
                 <span className="absolute top-2 right-2 bg-gray-900/80 backdrop-blur px-2 py-0.5 rounded-full text-[9px] font-black uppercase border border-gray-700 text-gray-300">
                    {item.tier}
                 </span>
              </div>

              <div className="p-3 flex-1 flex flex-col">
                <h3 className="font-bold text-sm text-gray-200 truncate">{item.name}</h3>
                
                <div className="mt-auto pt-3 flex items-end justify-between">
                    <div>
                        {item.isListed ? (
                            <>
                                <p className="text-[9px] uppercase text-gray-500 font-bold">Price</p>
                                <p className="text-sm font-black text-white">{formatEther(item.price)} ETH</p>
                            </>
                        ) : (
                            <p className="text-[10px] text-gray-500 italic">Not Listed</p>
                        )}
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-800">
                    {item.isListed ? (
                        isOwner ? (
                             <button disabled className="w-full py-2 bg-gray-800 text-gray-500 text-xs font-bold rounded cursor-not-allowed">You Listed This</button>
                        ) : (
                             <button onClick={() => handleBuy(item.tokenId, item.price)} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition">
                                Buy Now
                             </button>
                        )
                    ) : (
                        isOwner ? (
                            <button onClick={() => setListModalToken(item.tokenId)} className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded transition">
                                List for Sale
                            </button>
                        ) : (
                            <button onClick={() => setOfferModalToken(item.tokenId)} className="w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 text-gray-300 text-xs font-bold rounded transition">
                                Make Offer
                            </button>
                        )
                    )}
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* Offer Modal */}
      {offerModalToken !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-full max-w-sm">
                <h3 className="text-xl font-bold mb-1 text-white">Make an Offer</h3>
                <p className="text-xs text-gray-400 mb-6">Place an ETH bid on Token #{offerModalToken}. Escrowed securely.</p>
                
                <input 
                    type="text" 
                    placeholder="Amount in ETH (e.g. 0.05)" 
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 p-3 rounded-lg text-white font-mono mb-4 focus:border-blue-500 focus:outline-none"
                />

                <div className="mb-6">
                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Expiration</label>
                    <select 
                        value={offerDuration} 
                        onChange={(e) => setOfferDuration(Number(e.target.value))}
                        className="w-full bg-gray-950 border border-gray-700 p-3 rounded-lg text-white font-bold focus:border-blue-500 focus:outline-none"
                    >
                        <option value={86400}>1 Day</option>
                        <option value={259200}>3 Days</option>
                        <option value={604800}>7 Days</option>
                        <option value={2592000}>30 Days</option>
                    </select>
                </div>
                
                <div className="flex gap-3">
                    <button onClick={() => setOfferModalToken(null)} className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-bold text-sm hover:bg-gray-700">Cancel</button>
                    <button onClick={submitOffer} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-500">Lock Offer</button>
                </div>
            </div>
        </div>
      )}

      {/* List Modal */}
      {listModalToken !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-full max-w-sm">
                <h3 className="text-xl font-bold mb-1 text-white">List for Sale</h3>
                <p className="text-xs text-gray-400 mb-6">Set a price for Token #{listModalToken}. Includes 2% platform fee & royalties.</p>
                
                <input 
                    type="text" 
                    placeholder="Price in ETH (e.g. 0.1)" 
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 p-3 rounded-lg text-white font-mono mb-4 focus:border-purple-500 focus:outline-none"
                />

                <div className="mb-6">
                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Duration</label>
                    <select 
                        value={listDuration} 
                        onChange={(e) => setListDuration(Number(e.target.value))}
                        className="w-full bg-gray-950 border border-gray-700 p-3 rounded-lg text-white font-bold focus:border-purple-500 focus:outline-none"
                    >
                        <option value={86400}>1 Day</option>
                        <option value={259200}>3 Days</option>
                        <option value={604800}>7 Days</option>
                        <option value={2592000}>30 Days</option>
                    </select>
                </div>
                
                <div className="flex gap-3">
                    <button onClick={() => setListModalToken(null)} className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-bold text-sm hover:bg-gray-700">Cancel</button>
                    <button onClick={submitListing} className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-500">List Item</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}