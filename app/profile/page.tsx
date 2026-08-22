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
import BetaGate from "@/components/BetaGate";

const FACTORY_ADDRESS = "0x253FC033d3639A2d1df017685dB4837aC8C34a2B" as `0x${string}`;
const FACTORY_DEPLOY_BLOCK = 45796720n;
const CHUNK_SIZE = 2000n;

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

interface ActiveOffer {
  collectionAddress: string;
  collectionName?: string;
  tokenId: number;
  amount: bigint;
  expiresAt: number;
}

interface ReceivedOffer {
  collectionAddress: string;
  collectionName: string;
  tokenId: number;
  bidder: string;
  amount: bigint;
  expiresAt: number;
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [activeTab, setActiveTab] = useState<"inventory" | "listings" | "received_offers" | "escrow">("inventory");
  const [ownedNFTs, setOwnedNFTs] = useState<OwnedNFT[]>([]);
  const [activeOffers, setActiveOffers] = useState<ActiveOffer[]>([]);
  const [receivedOffers, setReceivedOffers] = useState<ReceivedOffer[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isOffersLoading, setIsOffersLoading] = useState(false);
  const [isReceivedOffersLoading, setIsReceivedOffersLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [updateModalNft, setUpdateModalNft] = useState<OwnedNFT | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [updateDuration, setUpdateDuration] = useState<number>(604800);

  const [listModalNft, setListModalNft] = useState<OwnedNFT | null>(null);
  const [quickListPrice, setQuickListPrice] = useState("");
  const [quickListDuration, setQuickListDuration] = useState<number>(604800);

  const { data: escrowBalance, refetch: refetchEscrow } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "escrowBalances",
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  const formattedEscrow = escrowBalance ? formatEther(escrowBalance as bigint) : "0";
  const hasEscrowFunds = escrowBalance && (escrowBalance as bigint) > 0n;

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

  const handleCancelOffer = async (offer: ActiveOffer) => {
    try {
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "cancelOffer",
        args: [offer.collectionAddress as `0x${string}`, BigInt(offer.tokenId)],
      });
      
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), {
        loading: `Canceling bid for Token #${offer.tokenId}...`,
        success: 'Offer canceled! ETH returned to wallet.',
        error: 'Failed to cancel offer.',
      });
      
      setRefreshTrigger(prev => prev + 1); 
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || "Transaction rejected.");
    }
  };

  const handleAcceptOffer = async (offer: ReceivedOffer) => {
    if (!isConnected) return toast.error("Connect wallet first!");
    try {
      const approveHash = await writeContractAsync({
        address: offer.collectionAddress as `0x${string}`,
        abi: BASEDRICK_LAUNCHPAD_ABI,
        functionName: "approve",
        args: [MARKETPLACE_ADDRESS, BigInt(offer.tokenId)],
      });

      await toast.promise(publicClient!.waitForTransactionReceipt({ hash: approveHash }), {
        loading: 'Approving marketplace transfer...',
        success: '✅ Approved! Finalizing sale...',
        error: 'Approval failed.',
      });

      const acceptHash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "acceptOffer",
        args: [
          offer.collectionAddress as `0x${string}`,
          BigInt(offer.tokenId),
          offer.bidder as `0x${string}`
        ],
      });

      await toast.promise(publicClient!.waitForTransactionReceipt({ hash: acceptHash }), {
        loading: 'Accepting offer & releasing ETH...',
        success: `🎉 Offer accepted! ETH sent directly to your wallet.`,
        error: 'Failed to accept offer.',
      });

      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || "Transaction rejected.");
    }
  };

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

  const handleDirectList = async () => {
    if (!listModalNft || !quickListPrice) return;
    try {
      const approvalHash = await writeContractAsync({
        address: listModalNft.collectionAddress as `0x${string}`,
        abi: BASEDRICK_LAUNCHPAD_ABI,
        functionName: "approve",
        args: [MARKETPLACE_ADDRESS, BigInt(listModalNft.tokenId)],
      });

      await toast.promise(publicClient!.waitForTransactionReceipt({ hash: approvalHash }), {
        loading: 'Approving marketplace...',
        success: '✅ Approved! Confirming listing...',
        error: 'Approval failed.',
      });

      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "createListing",
        args: [
          listModalNft.collectionAddress as `0x${string}`, 
          BigInt(listModalNft.tokenId), 
          parseEther(quickListPrice), 
          BigInt(quickListDuration)
        ],
      });

      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), {
        loading: 'Listing NFT on Marketplace...',
        success: '🚀 Successfully listed!',
        error: 'Listing failed.',
      });

      setListModalNft(null);
      setQuickListPrice("");
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || "Transaction rejected.");
    }
  };

  // ⚡ PUBLIC RPC IPFS RESOLVERS
  const resolveIpfsUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("ipfs://")) return url.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
    return url;
  };

  const fetchWithFallback = async (uri: string) => {
    if (!uri.startsWith("ipfs://")) {
      const res = await fetch(uri);
      return res.json();
    }
    const cidPath = uri.replace("ipfs://", "");
    const gateways = [
      "https://gateway.pinata.cloud/ipfs/",
      "https://dweb.link/ipfs/",
      "https://ipfs.io/ipfs/"
    ];
    for (const gateway of gateways) {
      try {
        const res = await fetch(`${gateway}${cidPath}`);
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    throw new Error("All IPFS gateways failed.");
  };

  useEffect(() => {
    const fetchOffers = async () => {
      if (!address || !publicClient) return;
      setIsOffersLoading(true);
      try {
        const logs = await publicClient.getContractEvents({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          eventName: "OfferMade",
          args: { bidder: address },
          fromBlock: FACTORY_DEPLOY_BLOCK,
          toBlock: "latest"
        });

        const uniqueTargets = new Map<string, { address: string, tokenId: number }>();
        logs.forEach(log => {
           const nftAddr = log.args.nftAddress;
           const tId = Number(log.args.tokenId);
           uniqueTargets.set(`${nftAddr}-${tId}`, { address: nftAddr as string, tokenId: tId });
        });

        const targets = Array.from(uniqueTargets.values());
        if (targets.length === 0) {
          setActiveOffers([]);
          return;
        }

        const offerCalls = targets.map(t => ({
           address: MARKETPLACE_ADDRESS,
           abi: MARKETPLACE_ABI,
           functionName: "offers",
           args: [t.address as `0x${string}`, BigInt(t.tokenId), address]
        }));

        const results = await publicClient.multicall({ contracts: offerCalls });

        const active: ActiveOffer[] = [];
        targets.forEach((t, i) => {
           const res = results[i];
           if (res.status === "success" && res.result) {
              const [amount, expiresAt, isActive] = res.result as [bigint, bigint, boolean];
              if (isActive) {
                 active.push({
                    collectionAddress: t.address,
                    tokenId: t.tokenId,
                    amount,
                    expiresAt: Number(expiresAt)
                 });
              }
           }
        });

        if (active.length > 0) {
           const nameCalls = active.map(o => ({
              address: o.collectionAddress as `0x${string}`,
              abi: BASEDRICK_LAUNCHPAD_ABI,
              functionName: "name"
           }));
           const nameResults = await publicClient.multicall({ contracts: nameCalls });
           active.forEach((o, i) => {
              o.collectionName = nameResults[i].status === "success" ? (nameResults[i].result as string) : "NFT Collection";
           });
        }

        setActiveOffers(active.sort((a, b) => Number(b.amount - a.amount)));
      } catch (err) {
        console.error("Failed to fetch active offers:", err);
      } finally {
        setIsOffersLoading(false);
      }
    };

    fetchOffers();
  }, [address, publicClient, refreshTrigger]);

  useEffect(() => {
    const fetchReceivedOffers = async () => {
      if (!address || !publicClient || ownedNFTs.length === 0) {
        setReceivedOffers([]);
        return;
      }

      setIsReceivedOffersLoading(true);
      try {
        const allOfferLogs = await publicClient.getContractEvents({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          eventName: "OfferMade",
          fromBlock: FACTORY_DEPLOY_BLOCK,
          toBlock: "latest"
        });

        const ownedTokenKeys = new Set(ownedNFTs.map(n => `${n.collectionAddress.toLowerCase()}-${n.tokenId}`));
        
        const matchingLogs = allOfferLogs.filter(log => {
          const key = `${(log.args.nftAddress as string).toLowerCase()}-${Number(log.args.tokenId)}`;
          return ownedTokenKeys.has(key) && (log.args.bidder as string).toLowerCase() !== address.toLowerCase();
        });

        if (matchingLogs.length === 0) {
          setReceivedOffers([]);
          return;
        }

        const candidateCalls = matchingLogs.map(log => ({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: "offers",
          args: [log.args.nftAddress as `0x${string}`, BigInt(log.args.tokenId as any), log.args.bidder as `0x${string}`]
        }));

        const results = await publicClient.multicall({ contracts: candidateCalls });

        const activeReceived: ReceivedOffer[] = [];
        matchingLogs.forEach((log, idx) => {
          const res = results[idx];
          if (res.status === "success" && res.result) {
            const [amount, expiresAt, isActive] = res.result as [bigint, bigint, boolean];
            const currentTimestamp = Math.floor(Date.now() / 1000);
            
            if (isActive && Number(expiresAt) > currentTimestamp) {
              const matchedNft = ownedNFTs.find(
                n => n.collectionAddress.toLowerCase() === (log.args.nftAddress as string).toLowerCase() && n.tokenId === Number(log.args.tokenId)
              );

              activeReceived.push({
                collectionAddress: log.args.nftAddress as string,
                collectionName: matchedNft?.collectionName || "NFT Collection",
                tokenId: Number(log.args.tokenId),
                bidder: log.args.bidder as string,
                amount,
                expiresAt: Number(expiresAt),
              });
            }
          }
        });

        const uniqueMap = new Map<string, ReceivedOffer>();
        activeReceived.forEach(o => {
          uniqueMap.set(`${o.collectionAddress}-${o.tokenId}-${o.bidder}`, o);
        });

        setReceivedOffers(Array.from(uniqueMap.values()).sort((a, b) => Number(b.amount - a.amount)));
      } catch (err) {
        console.error("Failed to fetch received offers:", err);
      } finally {
        setIsReceivedOffersLoading(false);
      }
    };

    fetchReceivedOffers();
  }, [address, publicClient, ownedNFTs, refreshTrigger]);

  // ⚡ OPTIMIZED PUBLIC RPC INVENTORY FETCH
  useEffect(() => {
    const fetchInventory = async () => {
      if (!address || !publicClient) return;
      setIsLoading(true);
      
      try {
        setLoadingStatus("Scanning ecosystem collections...");
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

        if (collections.length === 0) {
          setOwnedNFTs([]);
          setIsLoading(false);
          return;
        }

        setLoadingStatus("Querying balances via Multicall...");
        
        const balanceCalls = collections.map(addr => ({
          address: addr as `0x${string}`,
          abi: BASEDRICK_LAUNCHPAD_ABI,
          functionName: "balanceOf",
          args: [address]
        }));
        
        const balanceResults = await publicClient.multicall({ contracts: balanceCalls });
        
        const collectionsWithBalance: { address: string, balance: number }[] = [];
        balanceResults.forEach((res, index) => {
          if (res.status === "success" && (res.result as bigint) > 0n) {
            collectionsWithBalance.push({ 
              address: collections[index] as string, 
              balance: Number(res.result) 
            });
          }
        });

        if (collectionsWithBalance.length === 0) {
          setOwnedNFTs([]);
          setIsLoading(false);
          return;
        }

        setLoadingStatus("Fetching token IDs...");
        
        const tokenIdCalls: any[] = [];
        collectionsWithBalance.forEach(col => {
          for (let i = 0; i < col.balance; i++) {
            tokenIdCalls.push({
              address: col.address as `0x${string}`,
              abi: BASEDRICK_LAUNCHPAD_ABI,
              functionName: "tokenOfOwnerByIndex",
              args: [address, BigInt(i)]
            });
          }
        });

        const tokenIdResults = await publicClient.multicall({ contracts: tokenIdCalls });

        const userTokens: { collection: string, tokenId: number }[] = [];
        let callIndex = 0;
        collectionsWithBalance.forEach(col => {
          for (let i = 0; i < col.balance; i++) {
            const res = tokenIdResults[callIndex++];
            if (res.status === "success") {
              userTokens.push({ collection: col.address, tokenId: Number(res.result) });
            }
          }
        });

        setLoadingStatus("Resolving IPFS Metadata & Market Status...");
        
        const dataCalls: any[] = [];
        userTokens.forEach(t => {
          dataCalls.push({ address: t.collection as `0x${string}`, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "tokenURI", args: [BigInt(t.tokenId)] });
          dataCalls.push({ address: t.collection as `0x${string}`, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "name" });
          dataCalls.push({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: "listings", args: [t.collection as `0x${string}`, BigInt(t.tokenId)] });
        });

        const dataResults = await publicClient.multicall({ contracts: dataCalls });
        const metadataPromises = [];

        for (let i = 0; i < userTokens.length; i++) {
          const t = userTokens[i];
          const uriRes = dataResults[i * 3];
          const nameRes = dataResults[i * 3 + 1];
          const listingRes = dataResults[i * 3 + 2];

          const collectionName = nameRes.status === "success" ? nameRes.result as string : "Unknown Collection";
          const uri = uriRes.status === "success" ? uriRes.result as string : "";
          const listing = listingRes.status === "success" ? listingRes.result as [string, bigint, bigint, boolean] : null;

          let isListed = false;
          let listPrice = "0";

          if (listing) {
            const seller = listing[0] as string;
            const price = listing[1] as bigint;
            const isActive = listing[3] as boolean;
            
            if (isActive && seller.toLowerCase() === address.toLowerCase()) {
              isListed = true;
              listPrice = formatEther(price);
            }
          }

          const baseNFT = {
            collectionAddress: t.collection,
            collectionName,
            tokenId: t.tokenId,
            image: "",
            name: `Token #${t.tokenId}`,
            tier: "Common",
            isListed,
            listPrice
          };

          if (uri) {
            metadataPromises.push(
              fetchWithFallback(uri).then(meta => {
                const rarityAttr = meta.attributes?.find((a: any) => a.trait_type?.toLowerCase() === "rarity tier" || a.trait_type?.toLowerCase() === "tier");
                return {
                  ...baseNFT,
                  image: resolveIpfsUrl(meta.image),
                  name: meta.name || baseNFT.name,
                  tier: rarityAttr ? String(rarityAttr.value) : "Common"
                };
              }).catch(() => baseNFT)
            );
          } else {
            metadataPromises.push(Promise.resolve(baseNFT));
          }
        }

        const resolvedNFTs = await Promise.all(metadataPromises);
        setOwnedNFTs(resolvedNFTs.reverse());

      } catch (err) {
        console.error("Failed to load inventory:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInventory();
  }, [address, publicClient, refreshTrigger]);

  const activeListings = ownedNFTs.filter(nft => nft.isListed);
  const totalListedValue = activeListings.reduce((sum, item) => sum + parseFloat(item.listPrice || "0"), 0).toFixed(4);
  const totalActiveBidsValue = activeOffers.reduce((sum, o) => sum + o.amount, 0n);

  return (
    <BetaGate>
      <div className="min-h-screen bg-[#050505] text-white font-sans pb-24">
        
        <div className="border-b border-gray-800 bg-[#0a0a0a] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[300px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>

          <div className="max-w-[1600px] mx-auto px-6 py-12 relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl border border-gray-700 flex items-center justify-center text-4xl shadow-2xl">
                👾
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Collector Portfolio</h1>
                <p className="text-gray-400 font-mono text-xs mt-1.5 flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                      <span>{address}</span>
                    </>
                  ) : (
                    "Connect your wallet to manage your on-chain assets."
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 md:gap-6">
              <div className="bg-[#111] border border-gray-800 rounded-xl px-6 py-4 shadow-xl">
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Total Assets</p>
                <p className="text-2xl font-black text-blue-400">{ownedNFTs.length}</p>
              </div>
              <div className="bg-[#111] border border-gray-800 rounded-xl px-6 py-4 shadow-xl">
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Listed Value</p>
                <p className="text-2xl font-black text-purple-400">{totalListedValue} <span className="text-xs text-gray-500 font-bold">ETH</span></p>
              </div>
              <div className="bg-[#111] border border-gray-800 rounded-xl px-6 py-4 shadow-xl">
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Offers Received</p>
                <p className="text-2xl font-black text-emerald-400">{receivedOffers.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-6 py-8">
          
          {isConnected && (
            <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-8">
              <div className="flex flex-wrap gap-2 bg-[#0f0f0f] p-1 rounded-xl border border-gray-800">
                <button 
                  onClick={() => setActiveTab("inventory")}
                  className={`px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition ${activeTab === "inventory" ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                >
                  My Inventory ({ownedNFTs.length})
                </button>
                <button 
                  onClick={() => setActiveTab("listings")}
                  className={`px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition ${activeTab === "listings" ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                >
                  Active Listings ({activeListings.length})
                </button>
                <button 
                  onClick={() => setActiveTab("received_offers")}
                  className={`px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition flex items-center gap-2 ${activeTab === "received_offers" ? "bg-emerald-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                >
                  <span>Offers Received</span>
                  {receivedOffers.length > 0 && <span className="bg-emerald-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">{receivedOffers.length}</span>}
                </button>
                <button 
                  onClick={() => setActiveTab("escrow")}
                  className={`px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition flex items-center gap-2 ${activeTab === "escrow" ? "bg-amber-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                >
                  <span>Escrow & Bids</span>
                  {(hasEscrowFunds || activeOffers.length > 0) && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>}
                </button>
              </div>

              {isLoading && (
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 bg-blue-950/40 border border-blue-800/50 px-3 py-1.5 rounded-lg">
                  <div className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin"></div>
                  <span>{loadingStatus}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === "inventory" && (
            <>
              {!isConnected ? (
                <div className="bg-[#0f0f0f] border border-gray-800 rounded-2xl p-16 text-center max-w-lg mx-auto mt-12">
                  <span className="text-5xl mb-4 block">🔒</span>
                  <h3 className="text-xl font-bold text-white mb-2">Vault Locked</h3>
                  <p className="text-sm text-gray-500">Connect your wallet to inspect your on-chain assets.</p>
                </div>
              ) : isLoading && ownedNFTs.length === 0 ? (
                <div className="py-32 flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Scanning Blockchain Assets...</p>
                </div>
              ) : ownedNFTs.length === 0 ? (
                <div className="py-24 text-center bg-[#0f0f0f] border border-gray-800 rounded-2xl max-w-lg mx-auto">
                  <span className="text-5xl block mb-4 opacity-60">🕸️</span>
                  <h3 className="text-lg font-bold text-white mb-1">No Assets Found</h3>
                  <p className="text-xs text-gray-500 mb-6">Your personal vault is currently empty.</p>
                  <Link href="/marketplace" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 font-black text-xs rounded-xl shadow-lg transition">
                    Explore Drops
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                  {ownedNFTs.map((nft) => (
                    <div key={`${nft.collectionAddress}-${nft.tokenId}`} className="bg-[#121212] border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition flex flex-col group relative">
                      
                      <div className="absolute top-2 left-2 right-2 flex justify-between z-10 opacity-90">
                        <span className="bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-black border border-gray-700">#{nft.tokenId}</span>
                        <span className="bg-gray-900/80 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-black uppercase border border-gray-700">{nft.tier}</span>
                      </div>

                      <div className="aspect-square bg-black relative overflow-hidden">
                        {nft.image ? (
                          <img src={nft.image} alt={nft.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-800 text-xs">No Image</div>
                        )}
                        
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          {nft.isListed ? (
                            <span className="px-4 py-2 bg-purple-900/90 text-purple-200 text-xs font-bold rounded-lg border border-purple-700">
                              Listed: {nft.listPrice} ETH
                            </span>
                          ) : (
                            <button onClick={() => setListModalNft(nft)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg shadow-xl transition">
                              List for Sale
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-3.5 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider truncate mb-0.5">{nft.collectionName}</p>
                          <h4 className="text-xs font-bold text-white truncate">{nft.name}</h4>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-800/60 flex items-center justify-between">
                          {nft.isListed ? (
                            <span className="text-[10px] font-black text-purple-400">● On Market</span>
                          ) : (
                            <span className="text-[10px] font-mono text-gray-500">Unlisted</span>
                          )}
                          <Link href={`/marketplace/${nft.collectionAddress}`} className="text-[10px] font-bold text-gray-400 hover:text-white transition">
                            Market ↗
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "listings" && (
            <>
              {activeListings.length === 0 ? (
                <div className="py-24 text-center bg-[#0f0f0f] border border-gray-800 rounded-2xl max-w-lg mx-auto">
                  <span className="text-5xl block mb-4 opacity-60">🏷️</span>
                  <h3 className="text-lg font-bold text-white mb-1">No Active Listings</h3>
                  <p className="text-xs text-gray-500">You do not have any NFTs listed for sale on the marketplace.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                  {activeListings.map((nft) => (
                    <div key={`${nft.collectionAddress}-${nft.tokenId}-listing`} className="bg-[#121212] border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                      <div className="aspect-square bg-black relative">
                        {nft.image ? (
                          <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-800 text-xs">No Image</div>
                        )}
                        <span className="absolute top-2 left-2 bg-black/70 backdrop-blur px-2 py-0.5 rounded text-[10px] font-black border border-gray-700">
                          #{nft.tokenId}
                        </span>
                      </div>

                      <div className="p-3.5 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-purple-400 uppercase tracking-wider truncate mb-0.5">{nft.collectionName}</p>
                          <h4 className="text-xs font-bold text-white truncate mb-2">{nft.name}</h4>
                          <div className="bg-black border border-gray-800 p-2 rounded-lg">
                            <span className="text-[9px] uppercase font-bold text-gray-500 block">List Price</span>
                            <span className="text-sm font-black text-white">{nft.listPrice} ETH</span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-800/60 flex gap-2">
                          <button onClick={() => handleCancelListing(nft)} className="flex-1 py-2 bg-gray-900 hover:bg-red-950 hover:text-red-400 border border-gray-800 text-[10px] font-bold rounded-lg transition">
                            Cancel
                          </button>
                          <button onClick={() => setUpdateModalNft(nft)} className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg transition">
                            Edit Price
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "received_offers" && (
            <div className="max-w-4xl mx-auto mt-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black text-white">Offers Received</h2>
                  <p className="text-xs text-gray-400 mt-1">Review and accept bids made on items in your inventory.</p>
                </div>
              </div>

              {isReceivedOffersLoading ? (
                <div className="py-20 flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Checking Incoming Bids...</p>
                </div>
              ) : receivedOffers.length === 0 ? (
                <div className="bg-[#0f0f0f] border border-gray-800 rounded-2xl p-16 text-center max-w-lg mx-auto">
                  <span className="text-5xl mb-4 block opacity-50">📬</span>
                  <h3 className="text-lg font-bold text-white mb-1">No Offers Received</h3>
                  <p className="text-xs text-gray-500">You do not currently have any active bids on your items.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {receivedOffers.map((offer) => {
                    const isExpired = (Date.now() / 1000) > offer.expiresAt;

                    return (
                      <div key={`${offer.collectionAddress}-${offer.tokenId}-${offer.bidder}`} className="bg-[#121212] border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-emerald-500/50 transition shadow-xl">
                        <div>
                          <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider mb-1 block">{offer.collectionName}</span>
                          <h4 className="text-lg font-black text-white mb-1">Token #{offer.tokenId}</h4>
                          <p className="text-xs font-mono text-gray-500">Bidder: {offer.bidder.slice(0, 6)}...{offer.bidder.slice(-4)}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {isExpired ? (
                              <span className="text-red-400 bg-red-900/20 px-2 py-0.5 rounded">Expired</span>
                            ) : (
                              <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                                Expires: {new Date(offer.expiresAt * 1000).toLocaleString()}
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-6 border-t border-gray-800 pt-4 md:border-t-0 md:pt-0">
                          <div className="text-left md:text-right">
                            <span className="text-[10px] font-bold uppercase text-gray-500 block">Offer Amount</span>
                            <span className="text-2xl font-black text-emerald-400">{formatEther(offer.amount)} <span className="text-sm text-gray-400">ETH</span></span>
                          </div>

                          <button 
                            onClick={() => handleAcceptOffer(offer)}
                            disabled={isExpired}
                            className={`px-6 py-3 rounded-xl font-black text-xs transition ${
                              isExpired 
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                                : 'bg-emerald-600 hover:bg-emerald-500 text-black shadow-lg shadow-emerald-600/30'
                            }`}
                          >
                            Accept Offer
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "escrow" && (
            <div className="max-w-5xl mx-auto mt-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {/* IDLE ESCROW CARD */}
                <div className="bg-[#0f0f0f] border border-gray-800 rounded-3xl p-8 text-center shadow-2xl flex flex-col">
                  <span className="text-4xl block mb-4">🏦</span>
                  <h2 className="text-xl font-black text-white mb-2">Idle Escrow</h2>
                  <p className="text-xs text-gray-400 mb-6 flex-1">Funds from outbid or rejected offers waiting to be withdrawn to your wallet.</p>
                  
                  <div className="bg-black border border-gray-800 rounded-2xl p-4 mb-6">
                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Available to Withdraw</p>
                    <p className="text-3xl font-black text-amber-400">{formattedEscrow} ETH</p>
                  </div>

                  <button 
                    onClick={handleWithdrawEscrow}
                    disabled={!hasEscrowFunds}
                    className={`w-full py-3.5 rounded-xl font-black text-sm transition ${
                      hasEscrowFunds 
                        ? "bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20" 
                        : "bg-gray-900 text-gray-600 cursor-not-allowed border border-gray-800"
                    }`}
                  >
                    {hasEscrowFunds ? "Withdraw Escrow" : "No Funds in Escrow"}
                  </button>
                </div>

                {/* ACTIVE OFFERS CARD */}
                <div className="bg-[#0f0f0f] border border-gray-800 rounded-3xl p-8 text-center shadow-2xl flex flex-col">
                  <span className="text-4xl block mb-4">⚔️</span>
                  <h2 className="text-xl font-black text-white mb-2">Active Bids (Sent)</h2>
                  <p className="text-xs text-gray-400 mb-6 flex-1">ETH currently locked in smart contracts actively bidding on marketplace NFTs.</p>
                  
                  <div className="bg-black border border-gray-800 rounded-2xl p-4 mb-6">
                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Total Locked Value</p>
                    <p className="text-3xl font-black text-blue-400">{formatEther(totalActiveBidsValue)} ETH</p>
                  </div>

                  <div className="w-full py-3.5 rounded-xl font-black text-sm transition bg-gray-900 text-gray-400 border border-gray-800">
                    {activeOffers.length} Active {activeOffers.length === 1 ? 'Offer' : 'Offers'} Sent
                  </div>
                </div>
              </div>

              {/* LIST OF ACTIVE OFFERS */}
              <div>
                <h3 className="text-xl font-black text-white mb-4 border-b border-gray-800 pb-3">Your Sent Offers</h3>
                
                {isOffersLoading ? (
                  <p className="text-sm text-gray-500 animate-pulse">Scanning blockchain for active bids...</p>
                ) : activeOffers.length === 0 ? (
                  <div className="bg-[#111] border border-gray-800 rounded-xl p-8 text-center">
                    <p className="text-sm text-gray-400">You do not have any active sent offers on the marketplace.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {activeOffers.map(offer => {
                      const isExpired = (Date.now() / 1000) > offer.expiresAt;
                      
                      return (
                        <div key={`${offer.collectionAddress}-${offer.tokenId}`} className="bg-[#121212] border border-gray-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-gray-600 transition">
                          <div>
                            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-0.5">{offer.collectionName}</p>
                            <p className="text-base font-black text-white mb-1">Token #{offer.tokenId}</p>
                            <p className="text-xs text-gray-500 font-mono flex items-center gap-1.5">
                              {isExpired ? (
                                <span className="text-red-400 bg-red-900/20 px-2 py-0.5 rounded">Expired</span>
                              ) : (
                                <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                                  Expires: {new Date(offer.expiresAt * 1000).toLocaleString()}
                                </span>
                              )}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-6 border-t border-gray-800 pt-4 md:border-t-0 md:pt-0">
                            <div className="text-right flex-1 md:flex-none">
                              <p className="text-[10px] uppercase font-bold text-gray-500">Offer Amount</p>
                              <p className="text-xl font-black text-white">{formatEther(offer.amount)} <span className="text-sm text-gray-400">ETH</span></p>
                            </div>
                            <button 
                              onClick={() => handleCancelOffer(offer)} 
                              className="px-6 py-2.5 bg-gray-900 hover:bg-red-950 hover:text-red-400 hover:border-red-900 border border-gray-800 text-xs font-bold rounded-lg transition"
                            >
                              Cancel & Refund
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {updateModalNft && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-1">Update Listing Price</h3>
              <p className="text-xs text-gray-500 mb-4">{updateModalNft.name}</p>
              
              <input 
                type="text" 
                placeholder="New Price in ETH" 
                value={newPrice} 
                onChange={(e) => setNewPrice(e.target.value)} 
                className="w-full bg-black border border-gray-800 p-3 rounded-lg text-white font-mono text-sm mb-4 focus:border-purple-500 focus:outline-none" 
              />
              
              <div className="mb-6">
                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Duration</label>
                <select value={updateDuration} onChange={(e) => setUpdateDuration(Number(e.target.value))} className="w-full bg-black border border-gray-800 p-3 rounded-lg text-white font-bold text-xs focus:border-purple-500 focus:outline-none">
                  <option value={86400}>1 Day</option>
                  <option value={259200}>3 Days</option>
                  <option value={604800}>7 Days</option>
                  <option value={2592000}>30 Days</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setUpdateModalNft(null); setNewPrice(""); }} className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-bold text-xs hover:bg-gray-800 border border-gray-800">Cancel</button>
                <button onClick={handleUpdatePrice} disabled={!newPrice} className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg font-bold text-xs transition">Update Price</button>
              </div>
            </div>
          </div>
        )}

        {listModalNft && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-1">List on Marketplace</h3>
              <p className="text-xs text-gray-500 mb-4">{listModalNft.name}</p>
              
              <input 
                type="text" 
                placeholder="Price in ETH (e.g. 0.05)" 
                value={quickListPrice} 
                onChange={(e) => setQuickListPrice(e.target.value)} 
                className="w-full bg-black border border-gray-800 p-3 rounded-lg text-white font-mono text-sm mb-4 focus:border-blue-500 focus:outline-none" 
              />
              
              <div className="mb-6">
                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Duration</label>
                <select value={quickListDuration} onChange={(e) => setQuickListDuration(Number(e.target.value))} className="w-full bg-black border border-gray-800 p-3 rounded-lg text-white font-bold text-xs focus:border-blue-500 focus:outline-none">
                  <option value={86400}>1 Day</option>
                  <option value={259200}>3 Days</option>
                  <option value={604800}>7 Days</option>
                  <option value={2592000}>30 Days</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setListModalNft(null); setQuickListPrice(""); }} className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-bold text-xs hover:bg-gray-800 border border-gray-800">Cancel</button>
                <button onClick={handleDirectList} disabled={!quickListPrice} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg font-bold text-xs transition">Confirm Listing</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </BetaGate>
  );
}