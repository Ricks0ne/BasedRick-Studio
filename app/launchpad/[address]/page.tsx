"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { 
  useAccount, 
  useReadContracts, 
  useReadContract,
  useWriteContract,
  usePublicClient 
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import toast from "react-hot-toast";
import { 
  BASEDRICK_LAUNCHPAD_ABI, 
  MARKETPLACE_ABI, 
  MARKETPLACE_ADDRESS 
} from "@/abi";
// ⚡ IMPORT GLOBAL CACHE
import { resolveIpfsUrl, fetchMetadataWithCache } from "@/utils/ipfsCache";

interface MintedToken {
  tokenId: number;
  owner?: string;
  image?: string;
  name?: string;
  description?: string;
  tier?: string;
  attributes?: { trait_type: string; value: string | number }[];
}

export default function CollectionMintPage() {
  const params = useParams();
  const rawAddress = params?.address as string | undefined;
  const contractAddress = rawAddress ? (rawAddress.startsWith("0x") ? rawAddress : `0x${rawAddress}`) as `0x${string}` : undefined;

  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [mintQuantity, setMintQuantity] = useState<number>(1);
  const [creatorMintQty, setCreatorMintQty] = useState<number>(1);
  const [newBaseUri, setNewBaseUri] = useState<string>("");
  
  const [whitelistInput, setWhitelistInput] = useState<string>("");
  const [savedWhitelist, setSavedWhitelist] = useState<string[]>([]);

  const [mintedTokens, setMintedTokens] = useState<MintedToken[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [selectedToken, setSelectedToken] = useState<MintedToken | null>(null);
  const [galleryRefresh, setGalleryRefresh] = useState(0);

  const [wlStart, setWlStart] = useState("");
  const [wlEnd, setWlEnd] = useState("");
  const [pubStart, setPubStart] = useState("");
  const [pubEnd, setPubEnd] = useState("");

  const [isMinting, setIsMinting] = useState(false);
  const [mintSuccess, setMintSuccess] = useState(false);
  const [uriOptimisticallySet, setUriOptimisticallySet] = useState(false);

  useEffect(() => {
    if (!contractAddress) return;
    const fetchDecentralizedWhitelist = async () => {
      try {
        const res = await fetch(`/api/whitelist?contractAddress=${contractAddress}`);
        const data = await res.json();
        if (data.success && data.addresses && data.addresses.length > 0) {
          setSavedWhitelist(data.addresses);
        }
      } catch (err) {
        console.error("Failed to fetch whitelist from IPFS", err);
      }
    };
    fetchDecentralizedWhitelist();
  }, [contractAddress]);

  const safeAddress = userAddress || "0x0000000000000000000000000000000000000000";
  
  const contractsArray = useMemo(() => {
    if (!contractAddress) return [];
    const config = { address: contractAddress, abi: BASEDRICK_LAUNCHPAD_ABI, chainId: 84532 } as const;
    
    return [
      { ...config, functionName: "name" },
      { ...config, functionName: "symbol" },
      { ...config, functionName: "totalSupply" },
      { ...config, functionName: "maxSupply" },
      { ...config, functionName: "publicPrice" },
      { ...config, functionName: "whitelistPrice" },
      { ...config, functionName: "isPublicSaleActive" },
      { ...config, functionName: "isWhitelistActive" },
      { ...config, functionName: "whitelistStartTime" },
      { ...config, functionName: "whitelistEndTime" },
      { ...config, functionName: "publicStartTime" },
      { ...config, functionName: "publicEndTime" },
      { ...config, functionName: "merkleRoot" },
      { ...config, functionName: "owner" },
      { ...config, functionName: "baseURI" },
      { ...config, functionName: "maxPerWalletWhitelist" },
      { ...config, functionName: "maxPerWalletPublic" },
      { ...config, functionName: "whitelistMintCount", args: [safeAddress] },
      { ...config, functionName: "publicMintCount", args: [safeAddress] },
      { ...config, functionName: "maxCreatorAllocation" },
      { ...config, functionName: "creatorMinted" }
    ];
  }, [contractAddress, safeAddress]);

  const { data: contractData, refetch: refetchContractData, isLoading: isReading } = useReadContracts({
    contracts: contractsArray,
    query: { enabled: Boolean(contractAddress), refetchInterval: 5000 }
  });

  const name = contractData?.[0]?.result as string | undefined;
  const symbol = contractData?.[1]?.result as string | undefined;
  const totalSupply = contractData?.[2]?.result as bigint | undefined;
  const maxSupply = contractData?.[3]?.result as bigint | undefined;
  const publicPrice = contractData?.[4]?.result as bigint | undefined;
  const whitelistPrice = contractData?.[5]?.result as bigint | undefined;
  const isPublicSaleActive = contractData?.[6]?.result as boolean | undefined;
  const isWhitelistActive = contractData?.[7]?.result as boolean | undefined;
  const wlStartTimeOnChain = contractData?.[8]?.result as bigint | undefined;
  const wlEndTimeOnChain = contractData?.[9]?.result as bigint | undefined;
  const pubStartTimeOnChain = contractData?.[10]?.result as bigint | undefined;
  const pubEndTimeOnChain = contractData?.[11]?.result as bigint | undefined;
  const onChainMerkleRoot = contractData?.[12]?.result as string | undefined;
  const ownerAddress = contractData?.[13]?.result as string | undefined;
  const onChainBaseUri = contractData?.[14]?.result as string | undefined;

  const isBaseUriExplicitlyEmpty = contractData?.[14]?.status === "success" && (!onChainBaseUri || onChainBaseUri === "");

  const maxPerWalletWhitelist = contractData?.[15]?.result as bigint | undefined;
  const maxPerWalletPublic = contractData?.[16]?.result as bigint | undefined;
  const userWlMintCount = contractData?.[17]?.result as bigint | undefined;
  const userPubMintCount = contractData?.[18]?.result as bigint | undefined;

  const maxCreatorAllocation = contractData?.[19]?.result as bigint | undefined;
  const creatorMinted = contractData?.[20]?.result as bigint | undefined;

  const isOwner = userAddress && ownerAddress && userAddress.toLowerCase() === ownerAddress.toLowerCase();

  const maxWl = maxPerWalletWhitelist ? Number(maxPerWalletWhitelist) : 0;
  const maxPub = maxPerWalletPublic ? Number(maxPerWalletPublic) : 0;
  const wlMinted = userWlMintCount ? Number(userWlMintCount) : 0;
  const pubMinted = userPubMintCount ? Number(userPubMintCount) : 0;

  const wlRemaining = Math.max(0, maxWl - wlMinted);
  const pubRemaining = Math.max(0, maxPub - pubMinted);
  
  const maxCreatorAlloc = maxCreatorAllocation ? Number(maxCreatorAllocation) : 0;
  const creatorMintedCount = creatorMinted ? Number(creatorMinted) : 0;
  const remainingTotalSupply = maxSupply !== undefined && totalSupply !== undefined ? Math.max(0, Number(maxSupply) - Number(totalSupply)) : 0;
  const creatorRemaining = Math.min(Math.max(0, maxCreatorAlloc - creatorMintedCount), remainingTotalSupply);

  const activeRemaining = isWhitelistActive ? Math.min(wlRemaining, remainingTotalSupply) : (isPublicSaleActive ? Math.min(pubRemaining, remainingTotalSupply) : 0);
  
  const canMintWl = wlRemaining >= mintQuantity;
  const canMintPub = pubRemaining >= mintQuantity;
  const isSoldOut = totalSupply !== undefined && maxSupply !== undefined && totalSupply >= maxSupply;

  const formattedPublicPrice = publicPrice !== undefined ? formatEther(BigInt(publicPrice.toString())) : "0";
  const formattedWhitelistPrice = whitelistPrice !== undefined ? formatEther(BigInt(whitelistPrice.toString())) : "0";
  
  const activePrice = isWhitelistActive ? parseFloat(formattedWhitelistPrice) : (isPublicSaleActive ? parseFloat(formattedPublicPrice) : 0);
  const totalEthCost = (activePrice * mintQuantity).toFixed(4);

  const totalSupplyStr = totalSupply?.toString();

  // ⚡ OPTIMIZED PUBLIC RPC INTEGRATION WITH CACHE
  useEffect(() => {
    if (!contractAddress || !publicClient || totalSupplyStr === undefined) return;
    const count = Number(totalSupplyStr);
    if (count === 0) {
      setMintedTokens([]);
      return;
    }

    const loadMintedTokens = async () => {
      setIsLoadingGallery(true);
      try {
        const calls = [];
        for (let id = 1; id <= count; id++) {
          calls.push({ address: contractAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "tokenURI", args: [BigInt(id)] });
          calls.push({ address: contractAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "ownerOf", args: [BigInt(id)] });
        }
        
        const multicallRes = await publicClient.multicall({ contracts: calls });
        const metadataPromises = [];
                
        for (let i = 0; i < count; i++) {
          const tokenId = i + 1;
          const uriRes = multicallRes[i * 2];
          const ownerRes = multicallRes[i * 2 + 1];
          const owner = ownerRes.status === "success" ? ownerRes.result as string : undefined;
          
          const baseItem = { 
            tokenId, 
            owner, 
            name: `Token #${tokenId}`, 
            description: "", 
            image: "", 
            tier: "Common", 
            attributes: [] 
          };
          
          if (uriRes.status === "success" && uriRes.result) {
            metadataPromises.push(
              fetchMetadataWithCache(uriRes.result as string).then(meta => {
                const attrs = meta.attributes || [];
                const rarityAttr = attrs.find((a: any) => a.trait_type?.toLowerCase() === "rarity tier" || a.trait_type?.toLowerCase() === "tier");
                return {
                  ...baseItem,
                  name: meta.name || baseItem.name,
                  description: meta.description || "",
                  image: resolveIpfsUrl(meta.image),
                  tier: rarityAttr ? String(rarityAttr.value) : "Common",
                  attributes: attrs
                };
              }).catch(() => baseItem)
            );
          } else {
            metadataPromises.push(Promise.resolve(baseItem));
          }
        }
        
        const resolvedItems = await Promise.all(metadataPromises);
        setMintedTokens(resolvedItems.reverse());
      } catch (err) {
        console.error("Failed to load gallery items:", err);
      } finally {
        setIsLoadingGallery(false);
      }
    };

    loadMintedTokens();
  }, [contractAddress, publicClient, totalSupplyStr, onChainBaseUri, uriOptimisticallySet, galleryRefresh]); 

  const { merkleTree, userProof, isEligibleForWL, combinedList } = useMemo(() => {
    const newInputs = whitelistInput.split(/[\n,]+/).map((a) => a.trim().toLowerCase()).filter((a) => a.startsWith("0x") && a.length === 42);
    const allAddresses = Array.from(new Set([...savedWhitelist, ...newInputs]));
    
    const activeList = allAddresses.length > 0 ? allAddresses : (userAddress ? [userAddress.toLowerCase()] : []);
    const treeLeaves = activeList.map((addr) => keccak256(addr));
    const tree = new MerkleTree(treeLeaves, keccak256, { sortPairs: true });
    const leaf = userAddress ? keccak256(userAddress.toLowerCase()) : null;
    const proof = leaf ? tree.getHexProof(leaf) : [];
    
    return { merkleTree: tree, userProof: proof, isEligibleForWL: proof.length > 0, combinedList: allAddresses };
  }, [whitelistInput, savedWhitelist, userAddress]);

  const localRootHex = merkleTree.getLeafCount() > 0 ? (merkleTree.getHexRoot() as `0x${string}`) : "0x0000000000000000000000000000000000000000000000000000000000000000";
  const isRootSynced = Boolean(onChainMerkleRoot && localRootHex && onChainMerkleRoot.toLowerCase() === localRootHex.toLowerCase());

  const formatTime = (unix: any) => {
    if (!unix || unix.toString() === "0") return "Not Scheduled";
    return new Date(Number(unix) * 1000).toLocaleString();
  };

  const handlePublicMint = async () => {
    if (!isConnected) return toast.error("Please connect your wallet!");
    if (!publicPrice || !publicClient || !contractAddress) return;
    
    setIsMinting(true); setMintSuccess(false);
    try {
      const hash = await writeContractAsync({
        address: contractAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "publicMint",
        args: [BigInt(mintQuantity)], value: BigInt(publicPrice.toString()) * BigInt(mintQuantity),
      });
      
      await toast.promise(
        publicClient.waitForTransactionReceipt({ hash }),
        {
          loading: 'Confirming Mint on Base...',
          success: '🎉 Public Mint Successful!',
          error: 'Mint transaction failed.',
        }
      );
      
      setMintSuccess(true); 
      refetchContractData();
    } catch (err: any) { 
      toast.error(err?.shortMessage || err?.message || "Mint rejected."); 
    } finally { 
      setIsMinting(false); 
    }
  };

  const handleWhitelistMint = async () => {
    if (!isConnected) return toast.error("Please connect your wallet!");
    if (!whitelistPrice || !publicClient || !isEligibleForWL || !contractAddress) return;
    
    setIsMinting(true); setMintSuccess(false);
    try {
      const hash = await writeContractAsync({
        address: contractAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "whitelistMint",
        args: [BigInt(mintQuantity), userProof as `0x${string}`[]], value: BigInt(whitelistPrice.toString()) * BigInt(mintQuantity),
      });
      
      await toast.promise(
        publicClient.waitForTransactionReceipt({ hash }),
        {
          loading: 'Confirming WL Mint on Base...',
          success: '🎉 Whitelist Mint Successful!',
          error: 'Mint transaction failed.',
        }
      );
      
      setMintSuccess(true); 
      refetchContractData();
    } catch (err: any) { 
      toast.error(err?.shortMessage || err?.message || "Whitelist Mint rejected."); 
    } finally { 
      setIsMinting(false); 
    }
  };

  const handleSetSchedule = async () => {
    if (!isConnected || !userAddress) return toast.error("Please connect your wallet first!");
    if (!publicClient || !contractAddress) return;
    
    const wlS = wlStart ? Math.floor(new Date(wlStart).getTime() / 1000) : 0;
    const wlE = wlEnd ? Math.floor(new Date(wlEnd).getTime() / 1000) : 0;
    const pubS = pubStart ? Math.floor(new Date(pubStart).getTime() / 1000) : 0;
    const pubE = pubEnd ? Math.floor(new Date(pubEnd).getTime() / 1000) : 0;

    try {
      const { request } = await publicClient.simulateContract({
        address: contractAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "setSaleTimes",
        args: [BigInt(wlS), BigInt(wlE), BigInt(pubS), BigInt(pubE)], account: userAddress,
      });
      
      const hash = await writeContractAsync(request);
      
      await toast.promise(
        publicClient.waitForTransactionReceipt({ hash }),
        {
          loading: 'Locking schedule on-chain...',
          success: '✅ Sale schedule updated!',
          error: 'Failed to update schedule.',
        }
      );
      
      refetchContractData();
    } catch (err: any) { 
      toast.error(err?.shortMessage || err?.message || "Schedule update rejected."); 
    }
  };

  const handleCreatorMint = async () => {
    if (!publicClient || !userAddress || !contractAddress) return;
    if (creatorMintQty === 0 || creatorMintQty > creatorRemaining) {
      return toast.error(`Cannot mint ${creatorMintQty}. Remaining creator allocation is ${creatorRemaining}.`);
    }

    try {
      const hash = await writeContractAsync({
        address: contractAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "creatorMint",
        args: [userAddress, BigInt(creatorMintQty)],
      });
      
      await toast.promise(
        publicClient.waitForTransactionReceipt({ hash }),
        {
          loading: `Pre-minting ${creatorMintQty} NFTs...`,
          success: `✅ Successfully pre-minted ${creatorMintQty} NFTs!`,
          error: 'Creator mint failed.',
        }
      );
      
      setCreatorMintQty(1);
      refetchContractData();
    } catch (err: any) { 
      toast.error(err?.shortMessage || err?.message || "Creator mint rejected."); 
    }
  };

  const handleSetMerkleRoot = async () => {
    if (!publicClient || !contractAddress) return;
    
    try {
      await toast.promise(
        fetch("/api/whitelist", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addresses: combinedList, contractAddress })
        }).then(res => res.json()),
        {
          loading: 'Pinning Whitelist to IPFS...',
          success: 'Whitelist pinned!',
          error: 'IPFS Pinning failed.',
        }
      );

      const hash = await writeContractAsync({
        address: contractAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "setMerkleRoot",
        args: [localRootHex],
      });
      
      await toast.promise(
        publicClient.waitForTransactionReceipt({ hash }),
        {
          loading: 'Syncing Merkle Root to Base...',
          success: '✅ Whitelist fully decentralized!',
          error: 'Root sync failed.',
        }
      );
      
      setSavedWhitelist(combinedList); setWhitelistInput(""); refetchContractData();
    } catch (err: any) { 
      toast.error("Failed to configure Whitelist."); 
    }
  };

  const handleSetBaseUri = async () => {
    if (!newBaseUri || !publicClient || !contractAddress) return;
    
    try {
      const hash = await writeContractAsync({
        address: contractAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "setBaseURI",
        args: [newBaseUri],
      });
      
      await toast.promise(
        publicClient.waitForTransactionReceipt({ hash }),
        {
          loading: 'Updating metadata URI...',
          success: '✅ Metadata URI locked on-chain!',
          error: 'Failed to update URI.',
        }
      );
      
      setUriOptimisticallySet(true);
      setNewBaseUri(""); 
      refetchContractData();
    } catch (err: any) { 
      toast.error(err?.shortMessage || err?.message || "URI update rejected."); 
    }
  };

  const handleWithdraw = async () => {
    if (!publicClient || !contractAddress) return;
    
    try {
      const hash = await writeContractAsync({
        address: contractAddress, abi: BASEDRICK_LAUNCHPAD_ABI, functionName: "withdraw",
      });
      
      await toast.promise(
        publicClient.waitForTransactionReceipt({ hash }),
        {
          loading: 'Withdrawing funds...',
          success: '✅ Balance transferred to owner!',
          error: 'Withdrawal failed.',
        }
      );
    } catch (err: any) { 
      toast.error(err?.shortMessage || err?.message || "Withdrawal rejected."); 
    }
  };

  const mintedCount = totalSupply !== undefined ? totalSupply.toString() : "0";
  const totalCap = maxSupply !== undefined ? maxSupply.toString() : "0";

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 text-white">
      {/* Header Banner */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-8 mb-8 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase bg-blue-900/50 text-blue-400 border border-blue-700 px-3 py-1 rounded-full">
              Base Sepolia Collection
            </span>
            <h1 className="text-4xl font-black text-white mt-3">
              {isReading && !name ? "Loading..." : (name !== undefined ? String(name) : "Unnamed Collection")}
            </h1>
            <p className="text-gray-400 font-mono text-sm mt-1">Symbol: {symbol !== undefined ? String(symbol) : "..."}</p>
          </div>
          {contractAddress && (
            <a
              href={`https://sepolia.basescan.org/address/${contractAddress}`}
              target="_blank" rel="noreferrer"
              className="text-xs font-mono bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl border border-gray-700 transition"
            >
              {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)} ↗
            </a>
          )}
        </div>

        {/* Mint Counter Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-gray-800">
          <div>
            <p className="text-xs text-gray-400 uppercase">Total Minted</p>
            <p className="text-2xl font-bold text-white mt-1">{mintedCount} / {totalCap}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Whitelist Price</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">{formattedWhitelistPrice} ETH</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Public Price</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{formattedPublicPrice} ETH</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Live Status</p>
            <div className="mt-1 space-y-0.5 text-xs font-bold">
              <p className={isWhitelistActive ? "text-purple-400 animate-pulse" : "text-gray-500"}>
                WL: {isWhitelistActive ? "● Active Now" : "○ Paused/Waiting"}
              </p>
              <p className={isPublicSaleActive ? "text-green-400 animate-pulse" : "text-gray-500"}>
                Public: {isPublicSaleActive ? "● Active Now" : "○ Paused/Waiting"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mint Interaction Card */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-200 mb-6">Mint NFTs</h2>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-semibold text-gray-400">Quantity:</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={activeRemaining > 0 ? activeRemaining : 1}
                value={mintQuantity || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (isNaN(val)) {
                    setMintQuantity(0);
                  } else {
                    setMintQuantity(val > activeRemaining ? activeRemaining : val);
                  }
                }}
                disabled={activeRemaining === 0}
                className="w-24 bg-gray-950 border border-gray-700 text-white font-bold px-4 py-2.5 rounded-lg disabled:opacity-50 focus:outline-none focus:border-blue-500 text-center"
              />
              <button
                type="button"
                onClick={() => setMintQuantity(activeRemaining > 0 ? activeRemaining : 1)}
                disabled={activeRemaining === 0}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700 rounded-lg text-xs font-bold text-blue-400 transition"
              >
                MAX {activeRemaining > 0 ? `(${activeRemaining})` : ""}
              </button>
            </div>
          </div>

          {(isWhitelistActive || isPublicSaleActive) && isConnected && (
            <div className="text-right">
              <p className="text-lg font-black text-white">Total: {totalEthCost} ETH</p>
              <div className="text-xs font-mono text-gray-400 mt-1">
                {isWhitelistActive && (
                  <span className={wlRemaining === 0 ? "text-red-400" : ""}>WL Limit: {wlMinted}/{maxWl} Minted</span>
                )}
                {!isWhitelistActive && isPublicSaleActive && (
                  <span className={pubRemaining === 0 ? "text-red-400" : ""}>Public Limit: {pubMinted}/{maxPub} Minted</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {isWhitelistActive && (
            <button
              onClick={handleWhitelistMint} disabled={isMinting || isSoldOut || wlRemaining === 0 || !canMintWl || !isEligibleForWL || mintQuantity === 0}
              className={`flex-1 py-4 rounded-xl font-extrabold text-lg transition ${
                (isSoldOut || wlRemaining === 0 || !canMintWl || !isEligibleForWL || mintQuantity === 0) 
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed" 
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 shadow-lg shadow-purple-900/20"
              }`}
            >
              {isMinting ? "Minting..." : 
                isSoldOut ? "Sold Out" :
                !isEligibleForWL ? "Not Whitelisted" : 
                wlRemaining === 0 ? "Max WL Minted" : 
                !canMintWl ? `Exceeds Limit` : 
                `Mint via Whitelist (${totalEthCost} ETH)`}
            </button>
          )}

          {isPublicSaleActive && (
            <button
              onClick={handlePublicMint} disabled={isMinting || isSoldOut || pubRemaining === 0 || !canMintPub || mintQuantity === 0}
              className={`flex-1 py-4 rounded-xl font-extrabold text-lg transition ${
                (isSoldOut || pubRemaining === 0 || !canMintPub || mintQuantity === 0)
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 shadow-lg shadow-blue-900/20"
              }`}
            >
              {isMinting ? "Minting..." : 
                isSoldOut ? "Sold Out" :
                pubRemaining === 0 ? "Max Public Minted" : 
                !canMintPub ? `Exceeds Limit` : 
                `Mint via Public Sale (${totalEthCost} ETH)`}
            </button>
          )}

          {!isWhitelistActive && !isPublicSaleActive && (
            <button disabled className="w-full py-4 rounded-xl font-bold text-gray-500 bg-gray-800 border border-gray-700 cursor-not-allowed">
              Waiting for Scheduled Time...
            </button>
          )}
        </div>
      </div>

      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-8 mb-8">
        
        {isOwner && isBaseUriExplicitlyEmpty && !uriOptimisticallySet && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-500/50 rounded-xl text-red-200 text-sm">
            <span className="font-bold text-red-400 block mb-1">⚠️ Missing Base URI!</span>
            Your contract doesn't know where your IPFS images are stored yet. Scroll down to the Admin Panel, paste your IPFS Base URI (e.g. <span className="font-mono">ipfs://Qm.../</span>), and click "Set URI".
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>🖼️</span> Minted Tokens Gallery
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Live on-chain token inventory for {name || "this collection"}.
            </p>
          </div>
          <span className="text-xs font-mono bg-blue-900/40 text-blue-400 border border-blue-800 px-3 py-1 rounded-full">
            {mintedTokens.length} Minted
          </span>
        </div>

        {isLoadingGallery ? (
          <div className="py-16 text-center text-blue-400 flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-current border-t-transparent" />
            <p className="text-xs uppercase font-bold tracking-wider">Syncing On-Chain Metadata...</p>
          </div>
        ) : mintedTokens.length === 0 ? (
          <div className="border-2 border-dashed border-gray-800 rounded-2xl p-12 text-center text-gray-500">
            <span className="text-4xl block mb-2">📦</span>
            <p className="font-semibold text-gray-400">No tokens minted yet.</p>
            <p className="text-xs mt-1">Be the first to mint and reveal the collection artwork!</p>
          </div>
        ) : (
          <div className="max-h-[650px] overflow-y-auto custom-scrollbar pr-2 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {mintedTokens.map((token) => (
                <div
                  key={token.tokenId}
                  onClick={() => setSelectedToken(token)}
                  className="bg-gray-800/80 border border-gray-700 hover:border-blue-500 rounded-xl overflow-hidden cursor-pointer transition shadow-lg flex flex-col group"
                >
                  <div className="aspect-square bg-gray-950 overflow-hidden relative">
                    {token.image ? (
                      <img
                        src={token.image}
                        alt={token.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 text-[10px] font-bold p-4 text-center">
                        <span>Image Not Found</span>
                      </div>
                    )}
                    <span className="absolute top-2 left-2 font-mono text-[10px] font-black bg-black/70 backdrop-blur px-2 py-0.5 rounded text-white border border-gray-700">
                      #{token.tokenId}
                    </span>
                    {token.tier && token.tier !== "Unknown" && (
                      <span className={`absolute top-2 right-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        token.tier === "Mythic" ? "bg-purple-950/80 text-purple-300 border-purple-500" :
                        token.tier === "Legendary" ? "bg-amber-950/80 text-amber-300 border-amber-500" :
                        token.tier === "Epic" ? "bg-pink-950/80 text-pink-300 border-pink-500" :
                        token.tier === "Rare" ? "bg-blue-950/80 text-blue-300 border-blue-500" :
                        "bg-gray-900/80 text-gray-300 border-gray-700"
                      }`}>
                        {token.tier}
                      </span>
                    )}
                  </div>

                  <div className="p-3">
                    <h4 className="text-xs font-bold text-gray-200 truncate">{token.name}</h4>
                    {token.owner && (
                      <p className="text-[10px] font-mono text-gray-400 mt-1 truncate">
                        Owner: {token.owner.slice(0, 6)}...{token.owner.slice(-4)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Render the new, upgraded interactive modal */}
      {selectedToken && contractAddress && (
        <GalleryTokenModal 
          token={selectedToken} 
          contractAddress={contractAddress}
          collectionName={name}
          onClose={() => setSelectedToken(null)}
          onRefresh={() => setGalleryRefresh(prev => prev + 1)}
        />
      )}

      {isOwner && (
        <div className="bg-gray-900/40 border border-amber-500/30 rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-amber-400">⚡</span>
              <h2 className="text-xl font-bold text-amber-300">Creator Admin Panel</h2>
            </div>
            <button onClick={handleWithdraw} className="px-4 py-2 rounded-lg font-semibold text-sm bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition">
              Withdraw Funds
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-300 border-b border-gray-700 pb-2 mb-4">Time-Based Scheduling</h3>
                
                <div className="space-y-4">
                  <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                    <p className="text-xs font-bold text-purple-400 uppercase mb-3">Whitelist Phase</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-gray-400">Start Time</label>
                        <input type="datetime-local" value={wlStart} onChange={(e) => setWlStart(e.target.value)} className="bg-gray-900 text-xs text-white p-2 rounded border border-gray-700" />
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-gray-400">End Time</label>
                        <input type="datetime-local" value={wlEnd} onChange={(e) => setWlEnd(e.target.value)} className="bg-gray-900 text-xs text-white p-2 rounded border border-gray-700" />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">Current: {formatTime(wlStartTimeOnChain)} - {formatTime(wlEndTimeOnChain)}</p>
                    </div>
                  </div>

                  <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                    <p className="text-xs font-bold text-blue-400 uppercase mb-3">Public Phase</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-gray-400">Start Time</label>
                        <input type="datetime-local" value={pubStart} onChange={(e) => setPubStart(e.target.value)} className="bg-gray-900 text-xs text-white p-2 rounded border border-gray-700" />
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-gray-400">End Time</label>
                        <input type="datetime-local" value={pubEnd} onChange={(e) => setPubEnd(e.target.value)} className="bg-gray-900 text-xs text-white p-2 rounded border border-gray-700" />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">Current: {formatTime(pubStartTimeOnChain)} - {formatTime(pubEndTimeOnChain)}</p>
                    </div>
                  </div>

                  <button onClick={handleSetSchedule} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-black font-bold text-sm rounded-xl transition">
                    Lock In Schedule
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-300 border-b border-gray-700 pb-2 mb-4">Treasury & Metadata</h3>
                
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Creator Pre-Mint</label>
                    <span className="text-[10px] font-mono text-amber-400">
                      Quota: {creatorMintedCount}/{maxCreatorAlloc} Minted
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="1" 
                      max={creatorRemaining > 0 ? creatorRemaining : 1}
                      value={creatorMintQty || ""} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (isNaN(val)) {
                          setCreatorMintQty(0);
                        } else {
                          setCreatorMintQty(val > creatorRemaining ? creatorRemaining : val);
                        }
                      }}
                      disabled={creatorRemaining === 0} 
                      className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50 font-bold text-center focus:outline-none focus:border-amber-500" 
                    />
                    <button 
                      type="button"
                      onClick={() => setCreatorMintQty(creatorRemaining > 0 ? creatorRemaining : 1)}
                      disabled={creatorRemaining === 0}
                      className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700 rounded-lg text-xs font-bold text-amber-400 transition"
                    >
                      MAX {creatorRemaining > 0 ? `(${creatorRemaining})` : ""}
                    </button>
                    <button 
                      onClick={handleCreatorMint} 
                      disabled={creatorRemaining === 0 || creatorMintQty === 0 || creatorMintQty > creatorRemaining}
                      className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition"
                    >
                      {creatorRemaining === 0 ? "Allocation Full" : "Mint to Wallet"}
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase">Whitelist Addresses</label>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        <span className="text-blue-400 font-bold">{savedWhitelist.length}</span> addresses saved on IPFS
                      </p>
                    </div>
                    {onChainMerkleRoot && onChainMerkleRoot !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isRootSynced ? 'bg-green-900/50 text-green-400' : 'bg-amber-900/50 text-amber-400'}`}>
                        {isRootSynced ? "✓ Synced On-Chain" : "⚠️ Local Changes Unsaved"}
                      </span>
                    )}
                  </div>
                  
                  <textarea 
                    rows={2} 
                    value={whitelistInput} 
                    onChange={(e) => setWhitelistInput(e.target.value)} 
                    placeholder="Paste new addresses here to add them to your whitelist..."
                    className="w-full bg-gray-800 border border-gray-700 focus:border-purple-500 focus:outline-none rounded-lg p-2 text-xs text-white font-mono mb-2" 
                  />
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSetMerkleRoot} 
                      disabled={!whitelistInput.trim() && isRootSynced}
                      className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white font-bold text-sm rounded-lg transition"
                    >
                      Add & Update Root
                    </button>
                    {savedWhitelist.length > 0 && (
                      <button 
                        onClick={() => {
                          if (confirm("Are you sure?")) {
                            setSavedWhitelist([]);
                            setWhitelistInput("");
                          }
                        }} 
                        className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-900 text-red-400 font-bold text-sm rounded-lg transition"
                      >
                        Clear List
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Base Metadata URI</label>
                  {onChainBaseUri && (
                    <div className="mb-2 p-2 bg-gray-800/50 border border-gray-700 rounded text-[11px] text-gray-300 font-mono break-all">
                      <span className="text-blue-400 font-bold uppercase mr-2">Current On-Chain:</span> 
                      {onChainBaseUri}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input type="text" placeholder="ipfs://" value={newBaseUri} onChange={(e) => setNewBaseUri(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
                    <button onClick={handleSetBaseUri} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold text-sm rounded-lg transition">
                      Set URI
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// NEW MARKET-INTEGRATED GALLERY MODAL
// ----------------------------------------------------------------------------

interface GalleryTokenModalProps {
  token: MintedToken;
  contractAddress: `0x${string}`;
  collectionName?: string;
  onClose: () => void;
  onRefresh: () => void;
}

function GalleryTokenModal({ token, contractAddress, collectionName, onClose, onRefresh }: GalleryTokenModalProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [activeAction, setActiveAction] = useState<"view" | "list" | "offer">("view");
  const [listPrice, setListPrice] = useState("");
  const [listDuration, setListDuration] = useState<number>(604800);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerDuration, setOfferDuration] = useState<number>(604800);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch real-time marketplace status for this specific token
  const { data: listingData } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "listings",
    args: [contractAddress, BigInt(token.tokenId)],
    query: { enabled: !!contractAddress && !!token.tokenId }
  });

  const isListed = listingData ? Boolean(listingData[3]) : false;
  const listPriceFormatted = listingData ? formatEther(listingData[1] as bigint) : "0";
  const seller = listingData ? (listingData[0] as string) : undefined;

  // Determine permissions. If listed in escrow, the seller is the owner.
  const isOwnerOrSeller = address && (
    (token.owner && address.toLowerCase() === token.owner.toLowerCase()) || 
    (seller && address.toLowerCase() === seller.toLowerCase())
  );

  // Escape key listener to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleBuyNow = async () => {
    if (!isConnected) return toast.error("Connect wallet first!");
    setIsProcessing(true);
    try {
      const priceWei = parseEther(listPriceFormatted);
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "buyItem",
        args: [contractAddress, BigInt(token.tokenId)],
        value: priceWei,
      });
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), {
        loading: `Purchasing Token #${token.tokenId}...`,
        success: "🎉 Purchased successfully!",
        error: "Purchase failed.",
      });
      onClose(); onRefresh();
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || "Transaction rejected.");
    } finally { setIsProcessing(false); }
  };

  const handleCreateListing = async () => {
    if (!isConnected) return toast.error("Connect wallet first!");
    if (!listPrice || isNaN(Number(listPrice)) || Number(listPrice) <= 0) return toast.error("Enter valid price.");
    setIsProcessing(true);
    try {
      const approvalHash = await writeContractAsync({
        address: contractAddress,
        abi: BASEDRICK_LAUNCHPAD_ABI,
        functionName: "approve",
        args: [MARKETPLACE_ADDRESS, BigInt(token.tokenId)],
      });
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash: approvalHash }), {
        loading: "Approving marketplace...",
        success: "✅ Approved! Finalizing listing...",
        error: "Approval failed.",
      });

      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "createListing",
        args: [contractAddress, BigInt(token.tokenId), parseEther(listPrice), BigInt(listDuration)],
      });
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), {
        loading: "Listing on marketplace...",
        success: "🚀 Token listed for sale!",
        error: "Listing failed.",
      });
      onClose(); onRefresh();
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || "Transaction rejected.");
    } finally { setIsProcessing(false); }
  };

  const handleMakeOffer = async () => {
    if (!isConnected) return toast.error("Connect wallet first!");
    if (!offerAmount || isNaN(Number(offerAmount)) || Number(offerAmount) <= 0) return toast.error("Enter valid bid.");
    setIsProcessing(true);
    try {
      const offerWei = parseEther(offerAmount);
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "makeOffer",
        args: [contractAddress, BigInt(token.tokenId), BigInt(offerDuration)],
        value: offerWei,
      });
      await toast.promise(publicClient!.waitForTransactionReceipt({ hash }), {
        loading: `Submitting ${offerAmount} ETH bid...`,
        success: "🤝 Bid locked securely in escrow!",
        error: "Failed to place bid.",
      });
      onClose();
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || "Transaction rejected.");
    } finally { setIsProcessing(false); }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
    >
      {/* Modal Dialog Body - e.stopPropagation prevents clicks inside the modal from closing it */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0f0f0f] border border-gray-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/70 hover:bg-gray-800 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center font-bold transition">✕</button>

        {/* Image Half */}
        <div className="w-full md:w-1/2 bg-black flex items-center justify-center relative min-h-[300px] border-b md:border-b-0 md:border-r border-gray-800">
          {token.image ? (
            <img src={token.image} alt={token.name} className="w-full h-full object-contain max-h-[500px]" />
          ) : (
            <div className="text-gray-700 font-bold">Image Not Found</div>
          )}
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur px-3 py-1 rounded-lg border border-gray-800 text-xs font-mono font-bold text-white">#{token.tokenId}</div>
          
          {isListed && (
            <div className="absolute bottom-3 left-3 bg-purple-900/90 border border-purple-600 px-3 py-1 rounded-lg text-xs font-black text-purple-200 shadow-lg">
              Listed for {listPriceFormatted} ETH
            </div>
          )}
        </div>

        {/* Scrollable Data & Actions Half */}
        <div className="w-full md:w-1/2 flex flex-col max-h-[500px] md:max-h-[700px]">
          
          <div className="p-6 border-b border-gray-800 bg-[#121212]">
            <p className="text-[10px] uppercase font-bold text-blue-400 tracking-wider mb-1">{collectionName || "Collection Asset"}</p>
            <h2 className="text-2xl font-black text-white truncate pr-6">{token.name}</h2>
            {token.owner && (
              <p className="text-xs font-mono text-gray-500 mt-1">
                Owner: {token.owner.slice(0,6)}...{token.owner.slice(-4)} {isOwnerOrSeller && "(You)"}
              </p>
            )}
          </div>

          {/* TRAITS CONTAINER - fully scrollable */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
            {token.description && (
              <div>
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h4>
                <p className="text-xs text-gray-300 leading-relaxed bg-black/40 border border-gray-800/80 p-3 rounded-xl">{token.description}</p>
              </div>
            )}

            <div>
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Attributes & Traits ({token.attributes?.length || 0})</h4>
              {token.attributes && token.attributes.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {token.attributes.map((attr, idx) => (
                    <div key={idx} className="bg-black/50 border border-gray-800/90 rounded-xl p-3 flex flex-col justify-between hover:border-gray-700 transition">
                      <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider truncate mb-1">{attr.trait_type}</span>
                      <span className="text-xs font-bold text-white truncate">{String(attr.value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600 italic">No traits available.</p>
              )}
            </div>

            {/* Quick Listing Form */}
            {activeAction === "list" && (
              <div className="bg-[#141414] border border-blue-900/50 p-4 rounded-2xl space-y-3 animate-fadeIn">
                <h4 className="text-xs font-black text-blue-400 uppercase">Set Listing Price</h4>
                <input type="text" placeholder="Price in ETH" value={listPrice} onChange={(e) => setListPrice(e.target.value)} className="w-full bg-black border border-gray-800 p-2.5 rounded-xl text-white font-mono text-sm focus:border-blue-500 outline-none" />
                <select value={listDuration} onChange={(e) => setListDuration(Number(e.target.value))} className="w-full bg-black border border-gray-800 p-2.5 rounded-xl text-white text-xs font-bold focus:border-blue-500 outline-none">
                  <option value={86400}>1 Day</option><option value={259200}>3 Days</option><option value={604800}>7 Days</option>
                </select>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setActiveAction("view")} className="flex-1 py-2 bg-gray-900 text-gray-400 hover:text-white rounded-lg text-xs font-bold border border-gray-800">Back</button>
                  <button onClick={handleCreateListing} disabled={isProcessing} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black transition">Confirm Listing</button>
                </div>
              </div>
            )}

            {/* Quick Offer Form */}
            {activeAction === "offer" && (
              <div className="bg-[#141414] border border-emerald-900/50 p-4 rounded-2xl space-y-3 animate-fadeIn">
                <h4 className="text-xs font-black text-emerald-400 uppercase">Make an Escrow Offer</h4>
                <input type="text" placeholder="Offer in ETH" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} className="w-full bg-black border border-gray-800 p-2.5 rounded-xl text-white font-mono text-sm focus:border-emerald-500 outline-none" />
                <select value={offerDuration} onChange={(e) => setOfferDuration(Number(e.target.value))} className="w-full bg-black border border-gray-800 p-2.5 rounded-xl text-white text-xs font-bold focus:border-emerald-500 outline-none">
                  <option value={86400}>1 Day Expiration</option><option value={259200}>3 Days Expiration</option><option value={604800}>7 Days Expiration</option>
                </select>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setActiveAction("view")} className="flex-1 py-2 bg-gray-900 text-gray-400 hover:text-white rounded-lg text-xs font-bold border border-gray-800">Back</button>
                  <button onClick={handleMakeOffer} disabled={isProcessing} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-black rounded-lg text-xs font-black transition">Submit Bid</button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons Footer */}
          {activeAction === "view" && (
            <div className="p-4 border-t border-gray-800 bg-[#121212] flex gap-3">
              {isOwnerOrSeller ? (
                <button onClick={() => setActiveAction("list")} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition">
                  {isListed ? "Update Price" : "List for Sale"}
                </button>
              ) : (
                <>
                  {isListed && (
                    <button onClick={handleBuyNow} disabled={isProcessing} className="flex-1 py-3 bg-white text-black hover:bg-gray-200 rounded-xl text-xs font-black transition">
                      Buy Now
                    </button>
                  )}
                  <button onClick={() => setActiveAction("offer")} className={`py-3 rounded-xl text-xs font-black transition border border-gray-700 bg-gray-900 hover:bg-gray-800 text-white ${isListed ? "px-5" : "w-full"}`}>
                    Make Offer
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}