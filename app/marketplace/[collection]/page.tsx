"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAccount, useReadContracts, useWriteContract, usePublicClient } from "wagmi";
import { formatEther, parseEther } from "viem";
import toast from "react-hot-toast";
import { MARKETPLACE_ABI, MARKETPLACE_ADDRESS, BASEDRICK_LAUNCHPAD_ABI } from "@/abi";
// ⚡ IMPORT GLOBAL CACHE
import { resolveIpfsUrl, fetchMetadataWithCache } from "@/utils/ipfsCache";

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
  
  const rawAddress = (params?.address || params?.collection) as string | undefined;
  const collectionAddress = rawAddress ? (rawAddress.startsWith("0x") ? rawAddress : `0x${rawAddress}`) as `0x${string}` : undefined;

  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [items, setItems] = useState<NFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // ⚡ Last Sale Tracking State
  const [lastSalePrice, setLastSalePrice] = useState<bigint | null>(null);
  
  // ⚡ PRO LAYOUT & SWEEPER STATE
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterListed, setFilterListed] = useState(false);
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState("price_asc");
  
  // 🛒 Cart State
  const [cart, setCart] = useState<NFTItem[]>([]);

  // Modal States
  const [offerModalToken, setOfferModalToken] = useState<number | null>(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerDuration, setOfferDuration] = useState<number>(86400); 
  
  const [listModalToken, setListModalToken] = useState<number | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [listDuration, setListDuration] = useState<number>(604800); 

  // Fetch Collection Metadata
  const { data: collectionData } = useReadContracts({
    contracts: collectionAddress ? [
      { address: collectionAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "name" },
      { address: collectionAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "symbol" },
      { address: collectionAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "totalSupply" },
    ] : [],
  });

  const collectionName = collectionData?.[0]?.result as string | undefined;
  const symbol = collectionData?.[1]?.result as string | undefined;
  const totalSupply = collectionData?.[2]?.result as bigint | undefined;

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
      
      const multicallRes = await publicClient.multicall({ contracts: calls });
      const metadataPromises = [];
      
      for (let i = 0; i < count; i++) {
        const tokenId = i + 1;
        const uriRes = multicallRes[i * 3];
        const ownerRes = multicallRes[i * 3 + 1];
        const listingRes = multicallRes[i * 3 + 2];
        
        const owner = ownerRes.status === "success" ? ownerRes.result as string : "Unknown";
        const listing = listingRes.status === "success" ? listingRes.result as [string, bigint, bigint, boolean] : null;
        
        const isListed = listing ? listing[3] : false;
        const price = listing && isListed ? listing[1] : BigInt(0);
        
        const baseItem = { 
          tokenId, 
          owner, 
          name: `Token #${tokenId}`, 
          image: "", 
          tier: "Common", 
          isListed, 
          price 
        };
        
        if (uriRes?.status === "success" && uriRes.result) {
          metadataPromises.push(
            // ⚡ IMPLEMENTED GLOBAL CACHE HERE
            fetchMetadataWithCache(uriRes.result as string).then(meta => {
               const rarityAttr = meta.attributes?.find((a: any) => a.trait_type?.toLowerCase() === "rarity tier" || a.trait_type?.toLowerCase() === "tier");
               return {
                 ...baseItem,
                 name: meta.name || baseItem.name,
                 image: resolveIpfsUrl(meta.image),
                 tier: rarityAttr ? String(rarityAttr.value) : "Common"
               };
            }).catch(() => baseItem)
          );
        } else {
          metadataPromises.push(Promise.resolve(baseItem));
        }
      }
      
      const resolvedItems = await Promise.all(metadataPromises);
      setItems(resolvedItems.reverse()); 

      // ⚡ FETCH LAST SALE DATA
      try {
        const [purchaseLogs, offerLogs] = await Promise.all([
          publicClient.getContractEvents({
            address: MARKETPLACE_ADDRESS,
            abi: MARKETPLACE_ABI,
            eventName: "ListingPurchased",
            args: { nftAddress: collectionAddress },
            fromBlock: 45796720n, 
            toBlock: "latest",
          }),
          publicClient.getContractEvents({
            address: MARKETPLACE_ADDRESS,
            abi: MARKETPLACE_ABI,
            eventName: "OfferAccepted",
            args: { nftAddress: collectionAddress },
            fromBlock: 45796720n,
            toBlock: "latest",
          })
        ]);

        const allSales = [...purchaseLogs, ...offerLogs].sort((a, b) => 
          Number(b.blockNumber) - Number(a.blockNumber)
        );

        if (allSales.length > 0) {
          const newestSale = allSales[0];
          setLastSalePrice(newestSale.args.price as bigint);
        } else {
          setLastSalePrice(null); 
        }
      } catch (logError) {
        console.error("Failed to fetch sale history:", logError);
      }

    } catch (err) {
      toast.error("Failed to load marketplace data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMarketplaceData();
  }, [collectionAddress, totalSupply, publicClient]);

  // --- Filtering & Sorting Logic ---
  const activeListings = items.filter(i => i.isListed);
  const floorPrice = activeListings.length > 0 ? activeListings.reduce((min, p) => p.price < min ? p.price : min, activeListings[0].price) : BigInt(0);
  const listedPercentage = totalSupply && Number(totalSupply) > 0 ? ((activeListings.length / Number(totalSupply)) * 100).toFixed(1) : "0";

  let displayItems = items;

  if (filterListed) displayItems = displayItems.filter(i => i.isListed);
  if (selectedTiers.length > 0) displayItems = displayItems.filter(i => selectedTiers.includes(i.tier));
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    displayItems = displayItems.filter(i => i.name.toLowerCase().includes(q) || i.tokenId.toString().includes(q));
  }

  displayItems = [...displayItems].sort((a, b) => {
    if (sortOption === "price_asc") {
      if (!a.isListed && b.isListed) return 1;
      if (a.isListed && !b.isListed) return -1;
      return Number(a.price) - Number(b.price);
    }
    if (sortOption === "price_desc") {
      if (!a.isListed && b.isListed) return 1;
      if (a.isListed && !b.isListed) return -1;
      return Number(b.price) - Number(a.price);
    }
    if (sortOption === "id_asc") return a.tokenId - b.tokenId;
    if (sortOption === "id_desc") return b.tokenId - a.tokenId;
    return 0;
  });

  const toggleTier = (tier: string) => {
    setSelectedTiers(prev => prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier]);
  };

  // 🛒 Cart Toggles
  const toggleCartItem = (item: NFTItem) => {
    if (cart.find(i => i.tokenId === item.tokenId)) {
      setCart(cart.filter(i => i.tokenId !== item.tokenId));
    } else {
      setCart([...cart, item]);
    }
  };

  const cartTotal = cart.reduce((total, item) => total + item.price, BigInt(0));

  // --- Contract Interactions ---
  const handleBuy = async (tokenId: number, price: bigint) => {
    if (!isConnected) return toast.error("Connect wallet to buy");
    try {
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: "buyListing",
        args: [collectionAddress, BigInt(tokenId)], value: price,
      });
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), { loading: 'Processing purchase...', success: '🎉 NFT Purchased successfully!', error: 'Purchase failed' });
      
      // Remove from cart if it was there
      setCart(prev => prev.filter(i => i.tokenId !== tokenId));
      loadMarketplaceData();
    } catch (err: any) { toast.error(err.shortMessage || "Transaction rejected"); }
  };

  // 🛒 UPGRADED: True One-Click Sweep Execution
  const handleSweep = async () => {
    if (!isConnected) return toast.error("Connect wallet to buy");
    if (cart.length === 0) return;

    // Calculate total ETH needed and extract the array of token IDs
    const totalCost = cart.reduce((total, item) => total + item.price, BigInt(0));
    const tokenIdsToSweep = cart.map(item => BigInt(item.tokenId));

    try {
      // ONE single signature for the entire cart
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS, 
        abi: MARKETPLACE_ABI, 
        functionName: "buyBatch",
        args: [collectionAddress, tokenIdsToSweep], 
        value: totalCost,
      });

      const sweepToast = toast.loading(`Sweeping ${cart.length} NFTs in one transaction...`);
      
      await publicClient!.waitForTransactionReceipt({ hash });
      
      toast.dismiss(sweepToast);
      toast.success(`🎉 Floor Swept! You bought ${cart.length} items.`);
      
      setCart([]); // Empty the cart
      loadMarketplaceData(); // Refresh the grid
    } catch (err: any) {
      console.error("Sweep failed:", err);
      toast.error(err?.shortMessage || "Transaction rejected.");
    }
  };

  const submitOffer = async () => {
    if (!offerModalToken || !offerAmount) return;
    try {
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: "makeOffer",
        args: [collectionAddress, BigInt(offerModalToken), BigInt(offerDuration)], value: parseEther(offerAmount),
      });
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), { loading: 'Locking offer...', success: '✅ Offer placed successfully!', error: 'Offer failed' });
      setOfferModalToken(null); setOfferAmount("");
    } catch (err: any) { toast.error(err.shortMessage || "Transaction rejected"); }
  };

  const submitListing = async () => {
    if (!listModalToken || !listPrice || !collectionAddress) return;
    try {
      const approvalHash = await writeContractAsync({
        address: collectionAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "approve", args: [MARKETPLACE_ADDRESS, BigInt(listModalToken)],
      });
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash: approvalHash }), { loading: 'Approving...', success: '✅ Approved!', error: 'Approval failed' });

      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: "createListing",
        args: [collectionAddress, BigInt(listModalToken), parseEther(listPrice), BigInt(listDuration)],
      });
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), { loading: 'Listing NFT...', success: '🚀 Listed for sale!', error: 'Listing failed' });

      setListModalToken(null); setListPrice(""); loadMarketplaceData();
    } catch (err: any) { toast.error(err.shortMessage || "Transaction rejected"); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-24">
      
      {/* COMMAND CENTER HEADER */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-gray-800 px-6 py-6 shadow-2xl">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
             <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-center text-2xl shadow-inner">
               👾
             </div>
             <div>
                <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2">
                  {collectionName || "Loading..."} <span className="text-blue-500 text-lg">☑</span>
                </h1>
                <div className="flex items-center gap-3 text-xs font-mono text-gray-500 mt-1">
                   <span>{symbol}</span>
                   <span>•</span>
                   <a href={`https://sepolia.basescan.org/address/${collectionAddress}`} target="_blank" className="hover:text-blue-400 transition">{collectionAddress?.slice(0,6)}...{collectionAddress?.slice(-4)} ↗</a>
                </div>
             </div>
          </div>

          <div className="flex flex-wrap gap-6 md:gap-10">
             
             {/* ⚡ NEW: Last Sale Metric */}
             <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Last Sale</span>
                <span className="text-xl font-black text-white">
                  {lastSalePrice !== null ? formatEther(lastSalePrice) : "--"} <span className="text-sm text-gray-400">ETH</span>
                </span>
             </div>

             <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Floor Price</span>
                <span className="text-xl font-black text-white">{floorPrice > BigInt(0) ? formatEther(floorPrice) : "--"} <span className="text-sm text-gray-400">ETH</span></span>
             </div>
             <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Listed</span>
                <span className="text-xl font-black text-white">{activeListings.length} <span className="text-sm text-gray-400">({listedPercentage}%)</span></span>
             </div>
             <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Total Items</span>
                <span className="text-xl font-black text-white">{totalSupply !== undefined ? Number(totalSupply) : "--"}</span>
             </div>
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="max-w-[1600px] mx-auto px-4 py-8 flex flex-col md:flex-row gap-6">
        
        {/* COLLAPSIBLE SIDEBAR */}
        <div className={`transition-all duration-300 ${isSidebarOpen ? 'w-full md:w-72' : 'w-0 hidden md:block overflow-hidden'}`}>
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-2xl p-5 sticky top-36">
             <div className="mb-6">
                <h3 className="text-sm font-black uppercase text-gray-400 tracking-wider mb-3">Search</h3>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Token ID or Name" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none transition"
                  />
                </div>
             </div>

             <div className="mb-6 border-t border-gray-800 pt-6">
                <h3 className="text-sm font-black uppercase text-gray-400 tracking-wider mb-3">Status</h3>
                <button 
                  onClick={() => setFilterListed(!filterListed)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition ${filterListed ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700'}`}
                >
                  <span className="font-bold text-sm">Buy Now</span>
                  <span className="text-xs bg-black/40 px-2 py-0.5 rounded border border-gray-700">{activeListings.length}</span>
                </button>
             </div>

             <div className="border-t border-gray-800 pt-6">
                <h3 className="text-sm font-black uppercase text-gray-400 tracking-wider mb-3">Traits & Rarity</h3>
                <div className="flex flex-col gap-2">
                   {["Mythic", "Legendary", "Epic", "Rare", "Uncommon", "Common"].map((tier) => (
                     <label key={tier} className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${selectedTiers.includes(tier) ? 'bg-blue-600 border-blue-500' : 'bg-gray-900 border-gray-700 group-hover:border-gray-500'}`}>
                           {selectedTiers.includes(tier) && <span className="text-xs">✓</span>}
                        </div>
                        <input type="checkbox" className="hidden" checked={selectedTiers.includes(tier)} onChange={() => toggleTier(tier)} />
                        <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition">{tier}</span>
                     </label>
                   ))}
                </div>
             </div>
          </div>
        </div>

        {/* GRID AREA */}
        <div className="flex-1">
           {/* Toolbar */}
           <div className="flex items-center justify-between mb-6">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg text-gray-400 transition hidden md:block"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              </button>
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                 <span className="text-sm text-gray-500 font-bold hidden sm:block">{displayItems.length} Results</span>
                 <select 
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="w-full md:w-auto bg-gray-900 border border-gray-800 text-sm font-bold text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
                 >
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="id_asc">Token ID: Low to High</option>
                    <option value="id_desc">Token ID: High to Low</option>
                 </select>
              </div>
           </div>

           {/* Grid */}
           {isLoading ? (
             <div className="py-32 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-gray-500 font-bold tracking-widest uppercase">Fetching Market Data...</p>
             </div>
           ) : displayItems.length === 0 ? (
             <div className="py-32 text-center bg-gray-900/20 border border-gray-800/50 rounded-2xl">
                <span className="text-4xl block mb-3 opacity-50">📭</span>
                <p className="text-lg font-bold text-gray-400">No items match your filters.</p>
             </div>
           ) : (
             <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
               {displayItems.map((item) => {
                 const isOwner = userAddress?.toLowerCase() === item.owner.toLowerCase();
                 const inCart = cart.some(c => c.tokenId === item.tokenId);

                 return (
                   <div key={item.tokenId} className={`bg-[#121212] rounded-xl overflow-hidden hover:border-gray-500 transition group flex flex-col relative border ${inCart ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-gray-800'}`}>
                      
                      {/* Top Trait Badges */}
                      <div className="absolute top-2 left-2 right-2 flex justify-between z-10 opacity-90">
                         <span className="bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-black border border-gray-700">#{item.tokenId}</span>
                         <span className="bg-gray-900/80 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-black uppercase border border-gray-700">{item.tier}</span>
                      </div>

                      <div className="aspect-square bg-black relative overflow-hidden">
                        {item.image ? (
                           <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center text-gray-800 text-xs">No Image</div>
                        )}
                        
                        {/* ⚡ PRO FEATURE: Cart Toggles & CTAs */}
                        <div className={`absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 transition duration-200 ${inCart ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                           {item.isListed ? (
                               isOwner ? (
                                  <span className="px-4 py-2 bg-gray-800/90 backdrop-blur text-white text-xs font-bold rounded-lg border border-gray-600">Your Listing</span>
                               ) : (
                                  <>
                                    <button onClick={() => toggleCartItem(item)} className={`px-6 py-2.5 text-white text-sm font-black rounded-lg shadow-xl translate-y-4 group-hover:translate-y-0 transition border ${inCart ? 'bg-red-600 hover:bg-red-500 border-red-500' : 'bg-gray-800 hover:bg-gray-700 border-gray-600'}`}>
                                      {inCart ? "Remove" : "Add to Cart"}
                                    </button>
                                    {!inCart && (
                                      <button onClick={() => handleBuy(item.tokenId, item.price)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-lg shadow-xl translate-y-4 group-hover:translate-y-0 transition">
                                        Buy Now
                                      </button>
                                    )}
                                  </>
                               )
                           ) : (
                               isOwner ? (
                                  <button onClick={() => setListModalToken(item.tokenId)} className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-black rounded-lg shadow-xl translate-y-4 group-hover:translate-y-0 transition">
                                     List Item
                                  </button>
                               ) : (
                                  <button onClick={() => setOfferModalToken(item.tokenId)} className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-black rounded-lg shadow-xl border border-gray-600 translate-y-4 group-hover:translate-y-0 transition">
                                     Make Offer
                                  </button>
                               )
                           )}
                        </div>
                      </div>

                      <div className="p-3 flex-1 flex flex-col justify-between">
                         <div>
                            <h3 className="font-bold text-xs text-gray-300 truncate">{item.name}</h3>
                            <p className="text-[10px] text-gray-600 font-mono mt-0.5 truncate">Owner: {item.owner.slice(0,6)}...{item.owner.slice(-4)}</p>
                         </div>
                         <div className="mt-3 pt-3 border-t border-gray-800/50">
                            {item.isListed ? (
                               <div className="flex items-end justify-between">
                                  <span className="text-[10px] text-gray-500 uppercase font-bold">Price</span>
                                  <span className="text-sm font-black text-white">{formatEther(item.price)} ETH</span>
                               </div>
                            ) : (
                               <div className="flex items-center">
                                  <span className="text-[10px] text-gray-600 italic font-semibold">Not Listed</span>
                               </div>
                            )}
                         </div>
                      </div>
                   </div>
                 )
               })}
             </div>
           )}
        </div>
      </div>

      {/* 🛒 FLOATING SWEEPER CART */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 w-11/12 max-w-lg">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-2xl shadow-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600/20 text-blue-400 w-10 h-10 rounded-xl flex items-center justify-center font-black border border-blue-500/30">
                {cart.length}
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Cart Total</p>
                <p className="text-lg font-black text-white">{formatEther(cartTotal)} ETH</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setCart([])}
                className="text-gray-400 hover:text-white text-xs font-bold px-3 transition"
              >
                Clear
              </button>
              <button 
                onClick={handleSweep}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black text-sm px-6 py-3 rounded-xl shadow-lg shadow-blue-900/50 transition"
              >
                Sweep ({cart.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS (Offer & List) --- */}
      {offerModalToken !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                <h3 className="text-xl font-bold mb-1 text-white">Make an Offer</h3>
                <p className="text-xs text-gray-400 mb-6">Place an ETH bid on Token #{offerModalToken}. Escrowed securely.</p>
                <input type="text" placeholder="Amount in ETH (e.g. 0.05)" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-lg text-white font-mono mb-4 focus:border-blue-500 focus:outline-none" />
                <div className="mb-6">
                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Expiration</label>
                    <select value={offerDuration} onChange={(e) => setOfferDuration(Number(e.target.value))} className="w-full bg-black border border-gray-800 p-3 rounded-lg text-white font-bold focus:border-blue-500 focus:outline-none">
                        <option value={86400}>1 Day</option>
                        <option value={259200}>3 Days</option>
                        <option value={604800}>7 Days</option>
                        <option value={2592000}>30 Days</option>
                    </select>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setOfferModalToken(null)} className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-bold text-sm hover:bg-gray-800 border border-gray-800">Cancel</button>
                    <button onClick={submitOffer} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-500">Lock Offer</button>
                </div>
            </div>
        </div>
      )}

      {listModalToken !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                <h3 className="text-xl font-bold mb-1 text-white">List for Sale</h3>
                <p className="text-xs text-gray-400 mb-6">Set a price for Token #{listModalToken}. Includes protocol fees.</p>
                <input type="text" placeholder="Price in ETH (e.g. 0.1)" value={listPrice} onChange={(e) => setListPrice(e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-lg text-white font-mono mb-4 focus:border-purple-500 focus:outline-none" />
                <div className="mb-6">
                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Duration</label>
                    <select value={listDuration} onChange={(e) => setListDuration(Number(e.target.value))} className="w-full bg-black border border-gray-800 p-3 rounded-lg text-white font-bold focus:border-purple-500 focus:outline-none">
                        <option value={86400}>1 Day</option>
                        <option value={259200}>3 Days</option>
                        <option value={604800}>7 Days</option>
                        <option value={2592000}>30 Days</option>
                    </select>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setListModalToken(null)} className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-bold text-sm hover:bg-gray-800 border border-gray-800">Cancel</button>
                    <button onClick={submitListing} className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-500">List Item</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}