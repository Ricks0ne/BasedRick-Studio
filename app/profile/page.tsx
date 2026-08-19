"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { formatEther, parseEther } from "viem";
import toast from "react-hot-toast";
import { 
  LAUNCHPAD_FACTORY_ABI, 
  BASEDRICK_LAUNCHPAD_ABI, 
  MARKETPLACE_ABI, 
  MARKETPLACE_ADDRESS 
} from "@/abi";

const FACTORY_ADDRESS = "0x7f4F66418f0F20F8Bf8df41878803ffD08b04717" as `0x${string}`;
const FACTORY_DEPLOY_BLOCK = 45500000n;
const CHUNK_SIZE = 9000n;

interface OwnedNFT {
  collectionAddress: string;
  collectionName: string;
  tokenId: number;
  image: string;
  name: string;
  tier: string;
  isListed?: boolean;
  listPrice?: string;
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [activeTab, setActiveTab] = useState<"inventory" | "listings" | "escrow">("inventory");
  const [ownedNFTs, setOwnedNFTs] = useState<OwnedNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Listing Management State
  const [updateModalNft, setUpdateModalNft] = useState<OwnedNFT | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [updateDuration, setUpdateDuration] = useState<number>(604800); // ⚡ Default 7 Days

  // --- Escrow Logic ---
  const { data: escrowBalance, refetch: refetchEscrow } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "escrowBalances",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    }
  });

  const formattedEscrow = escrowBalance ? formatEther(escrowBalance as bigint) : "0";
  const hasEscrowFunds = escrowBalance && (escrowBalance as bigint) > BigInt(0);

  const handleWithdrawEscrow = async () => {
    if (!isConnected) return toast.error("Connect wallet first!");
    try {
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "withdrawEscrow",
      });
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), {
        loading: 'Withdrawing funds to wallet...',
        success: '✅ Escrow funds withdrawn successfully!',
        error: 'Withdrawal failed.',
      });
      refetchEscrow();
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || "Transaction rejected.");
    }
  };

  // --- Marketplace Listing Actions ---
  const handleCancelListing = async (nft: OwnedNFT) => {
    try {
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [nft.collectionAddress as `0x${string}`, BigInt(nft.tokenId)],
      });
      
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), {
        loading: `Canceling listing for ${nft.name}...`,
        success: 'Listing canceled successfully!',
        error: 'Failed to cancel listing.',
      });
      
      setRefreshTrigger(prev => prev + 1); 
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || "Transaction rejected.");
    }
  };

  const handleUpdatePrice = async () => {
    if (!updateModalNft || !newPrice) return;
    try {
      const priceWei = parseEther(newPrice);
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "updateListing",
        // ⚡ Updated to include the duration in seconds
        args: [
          updateModalNft.collectionAddress as `0x${string}`, 
          BigInt(updateModalNft.tokenId), 
          priceWei, 
          BigInt(updateDuration)
        ],
      });
      
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), {
        loading: 'Updating price on-chain...',
        success: '✅ Price updated successfully!',
        error: 'Failed to update price.',
      });
      
      setUpdateModalNft(null);
      setNewPrice("");
      setRefreshTrigger(prev => prev + 1); 
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || "Transaction rejected.");
    }
  };

  // --- Custom Factory Scanner ---
  const resolveIpfsUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("ipfs://")) return url.replace("ipfs://", "https://ipfs.io/ipfs/");
    return url;
  };

  const fetchWithFallback = async (uri: string) => {
    if (!uri.startsWith("ipfs://")) return (await fetch(uri)).json();
    const cidPath = uri.replace("ipfs://", "");
    const gateways = ["https://gateway.pinata.cloud/ipfs/", "https://dweb.link/ipfs/", "https://ipfs.io/ipfs/"];
    for (const gateway of gateways) {
      try {
        const res = await fetch(`${gateway}${cidPath}`);
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    throw new Error("All IPFS gateways failed.");
  };

  useEffect(() => {
    const fetchInventory = async () => {
      if (!address || !publicClient) return;

      setIsLoading(true);
      
      try {
        setLoadingStatus("Scanning network for collections...");
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
          } catch (e) {}
        }

        const collections = Array.from(new Set(allLogs.map(log => log.args.collectionAddress)));

        setLoadingStatus("Locating your assets...");
        const foundNFTs: OwnedNFT[] = [];

        for (const colAddress of collections) {
          try {
            const balance = await publicClient.readContract({
              address: colAddress as `0x${string}`,
              abi: BASEDRICK_LAUNCHPAD_ABI,
              functionName: "balanceOf",
              args: [address],
            }) as bigint;

            if (balance > 0n) {
              const colName = await publicClient.readContract({
                address: colAddress as `0x${string}`,
                abi: BASEDRICK_LAUNCHPAD_ABI,
                functionName: "name",
              }) as string;

              for (let i = 0; i < Number(balance); i++) {
                const tokenId = await publicClient.readContract({
                  address: colAddress as `0x${string}`,
                  abi: BASEDRICK_LAUNCHPAD_ABI,
                  functionName: "tokenOfOwnerByIndex",
                  args: [address, BigInt(i)],
                }) as bigint;

                let imageUrl = "";
                let nftName = `Token #${tokenId.toString()}`;
                let tier = "Unknown";

                try {
                  const uri = await publicClient.readContract({
                    address: colAddress as `0x${string}`,
                    abi: BASEDRICK_LAUNCHPAD_ABI,
                    functionName: "tokenURI",
                    args: [tokenId],
                  }) as string;

                  if (uri) {
                    const metadata = await fetchWithFallback(uri);
                    imageUrl = resolveIpfsUrl(metadata.image);
                    nftName = metadata.name || nftName;
                    
                    const rarityAttr = metadata.attributes?.find(
                      (a: any) => a.trait_type?.toLowerCase() === "rarity tier" || a.trait_type?.toLowerCase() === "tier"
                    );
                    if (rarityAttr) tier = String(rarityAttr.value);
                  }
                } catch (metaErr) {
                  console.warn("Failed to load metadata for token", tokenId);
                }

                foundNFTs.push({
                  collectionAddress: colAddress,
                  collectionName: colName,
                  tokenId: Number(tokenId),
                  image: imageUrl,
                  name: nftName,
                  tier: tier
                });
              }
            }
          } catch (contractErr) {
            console.warn(`Could not read collection ${colAddress}`);
          }
        }

        if (foundNFTs.length > 0) {
          setLoadingStatus("Checking active listings...");
          const listingCalls = foundNFTs.map(nft => ({
            address: MARKETPLACE_ADDRESS,
            abi: MARKETPLACE_ABI,
            functionName: "listings",
            args: [nft.collectionAddress as `0x${string}`, BigInt(nft.tokenId)]
          }));

          try {
            const listingResults = await publicClient.multicall({ contracts: listingCalls });
            
            foundNFTs.forEach((nft, index) => {
              const res = listingResults[index];
              if (res.status === "success" && res.result) {
                // ⚡ Updated to parse the 4-value struct returned by the new contract
                const [seller, price, expiresAt, isActive] = res.result as [string, bigint, bigint, boolean];
                
                if (isActive && seller.toLowerCase() === address.toLowerCase()) {
                  nft.isListed = true;
                  nft.listPrice = formatEther(price);
                }
              }
            });
          } catch (multiErr) {
            console.error("Failed to fetch listings statuses:", multiErr);
          }
        }

        setOwnedNFTs(foundNFTs.reverse());

      } catch (err) {
        console.error("Failed to load inventory:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInventory();
  }, [address, publicClient, refreshTrigger]);

  const activeListings = ownedNFTs.filter(nft => nft.isListed);

  return (
    <main className="max-w-7xl mx-auto px-4 py-12 text-white">
      {/* User Stats Hero */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-10 mb-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]"></div>
        
        <div className="w-24 h-24 bg-gray-800 rounded-full border-4 border-gray-700 flex items-center justify-center text-3xl z-10 shadow-xl">
          👾
        </div>
        
        <div className="z-10 flex-1 text-center md:text-left">
          <h2 className="text-3xl font-black text-white mb-2">Collector Vault</h2>
          <p className="text-gray-400 font-mono text-sm break-all">
            {isConnected ? address : "Connect your wallet to view your collected NFTs."}
          </p>
        </div>

        <div className="z-10 flex gap-4">
          <div className="bg-gray-900 border border-gray-700 px-8 py-4 rounded-2xl text-center">
            <p className="text-xs uppercase font-bold text-gray-500 mb-1">Total Assets</p>
            <p className="text-3xl font-black text-blue-400">{ownedNFTs.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-700 px-8 py-4 rounded-2xl text-center">
            <p className="text-xs uppercase font-bold text-gray-500 mb-1">Active Listings</p>
            <p className="text-3xl font-black text-purple-400">{activeListings.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-700 px-8 py-4 rounded-2xl text-center">
            <p className="text-xs uppercase font-bold text-gray-500 mb-1">Escrowed ETH</p>
            <p className="text-3xl font-black text-amber-400">{formattedEscrow}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {isConnected && (
        <div className="flex gap-4 mb-8">
          <button 
            onClick={() => setActiveTab("inventory")}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition ${activeTab === "inventory" ? "bg-blue-600 text-white" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"}`}
          >
            My Inventory
          </button>
          <button 
            onClick={() => setActiveTab("listings")}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition ${activeTab === "listings" ? "bg-purple-600 text-white" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"}`}
          >
            Active Listings
          </button>
          <button 
            onClick={() => setActiveTab("escrow")}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition flex items-center gap-2 ${activeTab === "escrow" ? "bg-amber-600 text-white" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"}`}
          >
            <span>Escrow & Offers</span>
            {hasEscrowFunds && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
          </button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "escrow" && (
        <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-8 max-w-2xl mx-auto mt-12 text-center">
          <span className="text-5xl block mb-4">🏦</span>
          <h2 className="text-2xl font-black text-white">Escrow Vault</h2>
          <p className="text-gray-400 text-sm mt-2 mb-8">
            When you make an offer on an NFT, your ETH is securely locked in the marketplace contract. 
            If your offer is outbid, rejected, or canceled, your funds instantly become available here for withdrawal.
          </p>

          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-8 shadow-inner">
            <p className="text-xs uppercase font-bold text-gray-500 tracking-widest mb-2">Available to Withdraw</p>
            <h3 className="text-5xl font-black text-amber-400 mb-8">{formattedEscrow} ETH</h3>
            
            <button 
              onClick={handleWithdrawEscrow}
              disabled={!hasEscrowFunds}
              className={`w-full py-4 rounded-xl font-extrabold text-lg transition ${
                hasEscrowFunds 
                  ? "bg-amber-500 hover:bg-amber-400 text-gray-900 shadow-lg shadow-amber-500/20" 
                  : "bg-gray-800 text-gray-600 cursor-not-allowed"
              }`}
            >
              {hasEscrowFunds ? "Withdraw Funds to Wallet" : "No Funds Available"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "listings" && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <h3 className="text-2xl font-bold text-gray-100">Marketplace Listings</h3>
            {isLoading && (
              <span className="flex items-center gap-2 text-xs text-purple-400 font-bold bg-purple-900/30 px-3 py-1.5 rounded-lg border border-purple-800/50">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-400 border-t-transparent" />
                {loadingStatus}
              </span>
            )}
          </div>

          {!isConnected ? (
             <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-16 text-center">
               <span className="text-6xl mb-4 block">🔒</span>
               <h3 className="text-2xl font-bold text-gray-200 mb-2">Vault Locked</h3>
             </div>
          ) : activeListings.length === 0 && !isLoading ? (
            <div className="text-center py-20 bg-gray-900/40 border border-gray-800 rounded-3xl">
              <span className="text-5xl block mb-4">🏷️</span>
              <h2 className="text-xl font-bold text-gray-200 mb-2">No Active Listings</h2>
              <p className="text-gray-500 max-w-md mx-auto">
                You haven't listed any of your NFTs for sale on the marketplace yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {activeListings.map((nft, idx) => (
                <div key={`${nft.collectionAddress}-${nft.tokenId}-listing`} className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden transition shadow-lg flex flex-col">
                  <div className="aspect-square bg-gray-950 relative overflow-hidden">
                    {nft.image ? (
                      <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs font-bold">No Image</div>
                    )}
                    <span className="absolute top-2 left-2 font-mono text-[10px] font-black bg-black/70 backdrop-blur px-2 py-0.5 rounded text-white border border-gray-700">
                      #{nft.tokenId}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <p className="text-[9px] font-bold text-purple-400 uppercase tracking-wider mb-1 truncate">{nft.collectionName}</p>
                    <h4 className="text-sm font-black text-gray-100 truncate mb-3">{nft.name}</h4>
                    
                    <div className="mb-4 bg-gray-950 rounded-lg p-2 border border-gray-800">
                       <p className="text-[10px] text-gray-500 uppercase font-bold">Current Price</p>
                       <p className="text-lg font-black text-white">{nft.listPrice} ETH</p>
                    </div>

                    <div className="mt-auto flex gap-2">
                      <button 
                        onClick={() => handleCancelListing(nft)}
                        className="flex-1 py-2 bg-gray-800 hover:bg-red-900/80 hover:text-red-300 hover:border-red-800 text-xs text-gray-400 font-bold rounded-lg transition border border-gray-700"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => setUpdateModalNft(nft)}
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-xs text-white font-bold rounded-lg transition"
                      >
                        Update Price
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "inventory" && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <h3 className="text-2xl font-bold text-gray-100">Collected NFTs</h3>
            {isLoading && (
              <span className="flex items-center gap-2 text-xs text-blue-400 font-bold bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-800/50">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-400 border-t-transparent" />
                {loadingStatus}
              </span>
            )}
          </div>

          {!isConnected ? (
            <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-16 text-center">
              <span className="text-6xl mb-4 block">🔒</span>
              <h3 className="text-2xl font-bold text-gray-200 mb-2">Vault Locked</h3>
              <p className="text-gray-500">Connect your wallet to inspect your inventory.</p>
            </div>
          ) : isLoading && ownedNFTs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-blue-400 gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-current border-t-transparent" />
              <p className="font-bold tracking-widest uppercase text-sm">Searching the Blockchain...</p>
            </div>
          ) : ownedNFTs.length === 0 ? (
            <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-16 text-center">
              <span className="text-6xl mb-4 block">🕸️</span>
              <h3 className="text-2xl font-bold text-gray-200 mb-2">No NFTs Found</h3>
              <p className="text-gray-500 mb-6">Your inventory is currently empty.</p>
              <Link 
                href="/launchpad"
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition"
              >
                Explore Active Drops
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {ownedNFTs.map((nft, idx) => (
                <div key={`${nft.collectionAddress}-${nft.tokenId}-${idx}`} className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden hover:border-blue-500/50 transition group flex flex-col shadow-xl">
                  
                  <div className="aspect-square bg-gray-950 relative overflow-hidden">
                    {nft.image ? (
                      <img src={nft.image} alt={nft.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs font-bold">No Image</div>
                    )}
                    
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      <span className="font-mono text-[10px] font-black bg-black/70 backdrop-blur px-2 py-0.5 rounded text-white border border-gray-700 shadow-sm">
                        #{nft.tokenId}
                      </span>
                    </div>

                    {nft.tier && nft.tier !== "Unknown" && (
                      <span className={`absolute top-2 right-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shadow-sm ${
                        nft.tier === "Mythic" ? "bg-purple-950/80 text-purple-300 border-purple-500" :
                        nft.tier === "Legendary" ? "bg-amber-950/80 text-amber-300 border-amber-500" :
                        nft.tier === "Epic" ? "bg-pink-950/80 text-pink-300 border-pink-500" :
                        nft.tier === "Rare" ? "bg-blue-950/80 text-blue-300 border-blue-500" :
                        "bg-gray-900/80 text-gray-300 border-gray-700"
                      }`}>
                        {nft.tier}
                      </span>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-1 truncate">
                      {nft.collectionName}
                    </p>
                    <h4 className="text-sm font-black text-gray-100 truncate mb-4">{nft.name}</h4>
                    
                    {nft.isListed ? (
                      <div className="mt-auto block text-center py-2 bg-gray-950 text-purple-400 text-xs font-bold rounded-lg border border-purple-900/50">
                        Listed for {nft.listPrice} ETH
                      </div>
                    ) : (
                      <Link 
                        href={`/marketplace/${nft.collectionAddress}`}
                        className="mt-auto block text-center py-2 bg-gray-800 group-hover:bg-blue-600 text-xs text-white font-bold rounded-lg transition duration-300 border border-gray-700 group-hover:border-blue-500"
                      >
                        View on Marketplace
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Update Price Modal */}
      {updateModalNft && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-full max-w-sm">
            <h3 className="text-xl font-bold mb-1 text-white">Update Listing Price</h3>
            <p className="text-xs text-gray-400 mb-6">Enter the new price for {updateModalNft.name}.</p>
            
            <div className="mb-4 bg-gray-950 rounded-lg p-3 border border-gray-800">
               <p className="text-[10px] text-gray-500 uppercase font-bold">Current Price</p>
               <p className="text-lg font-black text-white">{updateModalNft.listPrice} ETH</p>
            </div>

            <input 
              type="text" 
              placeholder="New Price in ETH (e.g. 0.05)" 
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 p-3 rounded-lg text-white font-mono mb-4 focus:border-purple-500 focus:outline-none"
            />

            {/* ⚡ Added Duration Dropdown */}
            <div className="mb-6">
                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">New Duration</label>
                <select 
                    value={updateDuration} 
                    onChange={(e) => setUpdateDuration(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-700 p-3 rounded-lg text-white font-bold focus:border-purple-500 focus:outline-none"
                >
                    <option value={86400}>1 Day</option>
                    <option value={259200}>3 Days</option>
                    <option value={604800}>7 Days</option>
                    <option value={2592000}>30 Days</option>
                </select>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => { setUpdateModalNft(null); setNewPrice(""); }} 
                className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-bold text-sm hover:bg-gray-700"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdatePrice} 
                disabled={!newPrice}
                className="flex-1 py-3 bg-purple-600 text-white disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-bold text-sm hover:bg-purple-500 transition"
              >
                Update Price
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}