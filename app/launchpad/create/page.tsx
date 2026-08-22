"use client";

import { useState } from "react";
import { useWriteContract, useAccount, usePublicClient } from "wagmi";
import { parseEther, decodeEventLog } from "viem";
import Link from "next/link";
import toast from "react-hot-toast";
import { LAUNCHPAD_FACTORY_ABI } from "@/abi";

const FACTORY_ADDRESS = "0x253FC033d3639A2d1df017685dB4837aC8C34a2B" as `0x${string}`;

interface GeneratedNFT {
  tokenId: number;
  tier: string;
  prompt: string;
  imageUrl: string;
  metadata: any;
}

export default function LaunchpadCreatePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [activeMode, setActiveMode] = useState<"ai" | "custom">("ai");

  // --- Shared Form State ---
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [whitelistPrice, setWhitelistPrice] = useState("0.001");
  const [publicPrice, setPublicPrice] = useState("0.002");
  
  // Mint Limits & Royalties
  const [maxWlMint, setMaxWlMint] = useState<number>(2);
  const [maxPubMint, setMaxPubMint] = useState<number>(5);
  const [maxCreatorAllocation, setMaxCreatorAllocation] = useState<number>(50);
  const [royaltyPercentage, setRoyaltyPercentage] = useState<number>(5);

  // --- AI Specific State ---
  const [description, setDescription] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [rarityTiers, setRarityTiers] = useState({
    Common: 5, Uncommon: 3, Rare: 2, Epic: 0, Legendary: 0, Mythic: 0,
  });
  const aiTotalSupply = Object.values(rarityTiers).reduce((sum, val) => sum + (val || 0), 0);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewItems, setPreviewItems] = useState<GeneratedNFT[]>([]);
  const [aiBaseUri, setAiBaseUri] = useState<string | null>(null);

  // --- Custom Art Specific State ---
  const [customSupply, setCustomSupply] = useState<number>(10);
  const [customBaseUri, setCustomBaseUri] = useState<string>("");

  // Pipeline & UI State
  const [isDeploying, setIsDeploying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const activeTotalSupply = activeMode === "ai" ? aiTotalSupply : customSupply;

  const handleGeneratePreview = async () => {
    if (!name || !basePrompt || aiTotalSupply === 0) {
      toast.error("Please fill in Name, Prompt, and ensure Supply > 0");
      return;
    }
    if (aiTotalSupply > 10) {
      toast.error("Beta Limit: You can generate a maximum of 10 NFTs per collection.");
      return;
    }

    setIsGenerating(true);
    setStatusMessage("Generating AI prompt matrix & trait attributes...");
    
    toast.promise(
      fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, basePrompt, totalSupply: aiTotalSupply, rarityTiers }),
      }).then(async (res) => {
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data;
      }),
      {
        loading: 'Generating AI Matrix...',
        success: (data) => {
          setPreviewItems(data.items);
          setStatusMessage(null);
          return 'Generation Complete!';
        },
        error: (err) => {
          setStatusMessage(null);
          return `Failed: ${err.message}`;
        }
      }
    ).finally(() => setIsGenerating(false));
  };

  // ⚡ THE MASTER ONE-CLICK DEPLOY PIPELINE FOR AI
  const handleOneClickDeploy = async () => {
    if (!isConnected || !address) return toast.error("Please connect your wallet first!");
    if (!publicClient) return toast.error("Network RPC client not ready.");
    if (activeTotalSupply <= 0 || activeTotalSupply > 10) return toast.error("Invalid supply.");
    if (previewItems.length === 0) return toast.error("Generate a preview first!");

    setIsDeploying(true);
    setDeployedAddress(null);
    setTxHash(null);

    try {
      // 1. PIN TO IPFS IN THE BACKGROUND
      setStatusMessage("Step 1/2: Pinning metadata to IPFS...");
      const ipfsRes = await fetch("/api/upload-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: previewItems }),
      });
      const ipfsData = await ipfsRes.json();
      if (!ipfsData.success) throw new Error(ipfsData.error || "IPFS Upload Failed");
      
      const generatedBaseUri = ipfsData.baseUri;
      setAiBaseUri(generatedBaseUri);

      // 2. LAUNCH CONTRACT WITH URI PRE-LOADED
      setStatusMessage("Step 2/2: Deploying Contract (Please sign in wallet)...");
      const royaltyBps = BigInt(Math.round(royaltyPercentage * 100));

      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: LAUNCHPAD_FACTORY_ABI,
        functionName: "launchCollection",
        args: [
          name,
          symbol,
          BigInt(activeTotalSupply),
          parseEther(whitelistPrice || "0"),
          parseEther(publicPrice || "0"),
          BigInt(maxWlMint),
          BigInt(maxPubMint),
          BigInt(maxCreatorAllocation),
          royaltyBps,
          generatedBaseUri // ⚡ Passed directly to the contract!
        ],
      });

      setTxHash(hash);
      setStatusMessage("Waiting for Base block confirmation...");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let newAddress: string | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: LAUNCHPAD_FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "CollectionLaunched") {
            newAddress = (decoded.args as any).collectionAddress;
            break;
          }
        } catch (e) {}
      }

      setDeployedAddress(newAddress && newAddress !== "0x0000000000000000000000000000000000000000" ? newAddress : "Deployed (Check BaseScan)");
      setStatusMessage("✅ Complete! Collection deployed with metadata synced.");
      toast.success("Collection Successfully Deployed!");

    } catch (err: any) {
      console.error("Deploy failed:", err);
      toast.error(err?.shortMessage || err?.message || "Deployment failed.");
      setStatusMessage(null);
    } finally {
      setIsDeploying(false);
    }
  };

  // ⚡ CUSTOM ART DEPLOYMENT
  const handleCustomDeploy = async () => {
    if (!isConnected || !address) return toast.error("Please connect your wallet first!");
    if (!publicClient) return toast.error("Network RPC client not ready.");
    if (activeTotalSupply <= 0 || activeTotalSupply > 10) return toast.error("Invalid supply.");

    setIsDeploying(true);
    setDeployedAddress(null);
    setTxHash(null);

    try {
      setStatusMessage("Deploying Contract (Please sign in wallet)...");
      const royaltyBps = BigInt(Math.round(royaltyPercentage * 100));

      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: LAUNCHPAD_FACTORY_ABI,
        functionName: "launchCollection",
        args: [
          name,
          symbol,
          BigInt(activeTotalSupply),
          parseEther(whitelistPrice || "0"),
          parseEther(publicPrice || "0"),
          BigInt(maxWlMint),
          BigInt(maxPubMint),
          BigInt(maxCreatorAllocation),
          royaltyBps,
          customBaseUri // ⚡ User's provided URI
        ],
      });

      setTxHash(hash);
      setStatusMessage("Waiting for Base block confirmation...");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let newAddress: string | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: LAUNCHPAD_FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "CollectionLaunched") {
            newAddress = (decoded.args as any).collectionAddress;
            break;
          }
        } catch (e) {}
      }

      setDeployedAddress(newAddress && newAddress !== "0x0000000000000000000000000000000000000000" ? newAddress : "Deployed (Check BaseScan)");
      setStatusMessage("✅ Complete! Custom Collection deployed.");
      toast.success("Collection Successfully Deployed!");

    } catch (err: any) {
      console.error("Deploy failed:", err);
      toast.error(err?.shortMessage || err?.message || "Deployment failed.");
      setStatusMessage(null);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleRarityChange = (tier: string, value: string) => {
    const num = parseInt(value);
    setRarityTiers(prev => ({ ...prev, [tier]: isNaN(num) ? 0 : num }));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12 text-white">
      <div className="border-b border-gray-800 pb-6 mb-8">
        <h1 className="text-4xl font-black text-blue-500">Creator Studio</h1>
        <p className="text-gray-400 mt-2">
          Deploy zero-code smart contracts on Base. Choose your creation mode below.
        </p>
      </div>

      <div className="flex bg-gray-900 p-1 rounded-xl mb-8 border border-gray-800 w-full max-w-md mx-auto">
        <button
          onClick={() => setActiveMode("ai")}
          className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${activeMode === "ai" ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
        >
          🤖 AI Generator
        </button>
        <button
          onClick={() => setActiveMode("custom")}
          className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${activeMode === "custom" ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
        >
          🎨 Custom Art Upload
        </button>
      </div>

      {deployedAddress && (
        <div className="mb-8 p-6 bg-green-950/60 border border-green-500/50 rounded-2xl shadow-xl animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎉</span>
            <div className="w-full">
              <h3 className="text-xl font-bold text-green-300">Collection Deployed Successfully!</h3>
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-300">
                  Contract Address:{" "}
                  <span className="font-mono bg-black/40 px-2 py-1 rounded text-green-400 border border-green-800">
                    {deployedAddress}
                  </span>
                </p>
                {(aiBaseUri || customBaseUri) && (
                  <p className="text-sm text-gray-300">
                    IPFS Base URI:{" "}
                    <span className="font-mono bg-black/40 px-2 py-1 rounded text-purple-400 border border-purple-800 break-all select-all">
                      {activeMode === "ai" ? aiBaseUri : customBaseUri}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-4">
            {txHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-semibold rounded-lg border border-gray-600 transition"
              >
                View Transaction on BaseScan ↗
              </a>
            )}
            {deployedAddress && !deployedAddress.includes("Check BaseScan") && (
              <Link
                href={`/launchpad/${deployedAddress}`}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-sm font-bold rounded-lg transition"
              >
                Go to Admin Dashboard →
              </Link>
            )}
          </div>
        </div>
      )}

      {statusMessage && !deployedAddress && (
        <div className={`mb-8 p-4 border rounded-xl flex items-center gap-3 ${
          statusMessage.includes("✅") ? "bg-green-950/60 border-green-500/50" : "bg-blue-950/60 border-blue-500/50"
        }`}>
          {!statusMessage.includes("✅") && (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
          )}
          <p className={`text-sm font-medium ${statusMessage.includes("✅") ? "text-green-200" : "text-blue-200"}`}>
            {statusMessage}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6 bg-gray-900/60 p-6 rounded-2xl border border-gray-800">
          <h2 className="text-xl font-bold text-gray-200">1. Collection Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Collection Name</label>
              <input
                type="text"
                placeholder="e.g. Based Cyber Rick"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Token Symbol</label>
              <input
                type="text"
                placeholder="e.g. BRICK"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 uppercase"
              />
            </div>
          </div>

          {activeMode === "ai" ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Base Prompt AI Concept</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Rick Sanchez in futuristic armor, neon reflections"
                  value={basePrompt}
                  onChange={(e) => setBasePrompt(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-gray-800">
                <h2 className="text-xl font-bold text-gray-200 mb-1">2. Rarity Distribution</h2>
                <p className="text-xs text-gray-400 mb-4">Define supply per tier. Attributes will dynamically scale with rarity.</p>
                
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(rarityTiers).map(([tier, count]) => (
                    <div key={tier} className="bg-gray-950 p-2 rounded-lg border border-gray-800">
                      <label className={`block text-[10px] font-black uppercase mb-1 ${
                        tier === 'Mythic' ? 'text-purple-400' :
                        tier === 'Legendary' ? 'text-amber-400' :
                        tier === 'Epic' ? 'text-pink-400' :
                        tier === 'Rare' ? 'text-blue-400' :
                        tier === 'Uncommon' ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {tier}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={count === 0 ? "" : count}
                        placeholder="0"
                        onChange={(e) => handleRarityChange(tier, e.target.value)}
                        className="w-full bg-transparent text-white font-mono text-lg focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 bg-blue-900/30 border border-blue-800/50 rounded-xl p-4 flex justify-between items-center">
                   <span className="text-sm font-bold text-gray-300">Total AI Supply:</span>
                   <span className="text-2xl font-black text-blue-400">{aiTotalSupply}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="pt-4 border-t border-gray-800">
              <h2 className="text-xl font-bold text-gray-200 mb-4">2. Supply & Metadata</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                    Total Supply <span className="text-blue-400">(Max 10 Beta Cap)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={customSupply}
                    onChange={(e) => setCustomSupply(Math.min(10, Math.max(1, Number(e.target.value))))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">IPFS Base URI</label>
                  <input
                    type="text"
                    placeholder="ipfs://QmYourCidHashHere/"
                    value={customBaseUri}
                    onChange={(e) => setCustomBaseUri(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 font-mono text-sm"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Make sure your CID ends with a trailing slash <span className="font-mono text-gray-400">/</span></p>
                </div>
              </div>
            </div>
          )}

          <h2 className="text-xl font-bold text-gray-200 pt-4 border-t border-gray-800">3. Mint Pricing (ETH)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Whitelist Price</label>
              <input
                type="text"
                placeholder="0.001"
                value={whitelistPrice}
                onChange={(e) => setWhitelistPrice(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Public Price</label>
              <input
                type="text"
                placeholder="0.002"
                value={publicPrice}
                onChange={(e) => setPublicPrice(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-200 pt-4 border-t border-gray-800">4. Limits & Royalties</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Max Whitelist</label>
              <input
                type="number"
                min="1"
                value={maxWlMint}
                onChange={(e) => setMaxWlMint(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Max Public</label>
              <input
                type="number"
                min="1"
                value={maxPubMint}
                onChange={(e) => setMaxPubMint(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Creator Alloc.</label>
              <input
                type="number"
                min="0"
                value={maxCreatorAllocation}
                onChange={(e) => setMaxCreatorAllocation(Number(e.target.value))}
                className="w-full bg-gray-900 border border-amber-900/50 rounded-lg px-3 py-2 text-amber-500 font-bold focus:outline-none focus:border-amber-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Royalty (%)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={royaltyPercentage}
                onChange={(e) => {
                  let val = Number(e.target.value);
                  if (val > 10) val = 10;
                  if (val < 0) val = 0;
                  setRoyaltyPercentage(val);
                }}
                className="w-full bg-gray-900 border border-purple-900/50 rounded-lg px-3 py-2 text-purple-400 font-bold focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-4">
            {activeMode === "ai" ? (
              <>
                <button
                  onClick={handleGeneratePreview}
                  disabled={isGenerating || isDeploying}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  1. Generate AI Preview
                </button>
                <button
                  onClick={handleOneClickDeploy}
                  disabled={isDeploying || previewItems.length === 0}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 disabled:from-gray-700 disabled:to-gray-700 text-white font-black py-4 px-4 rounded-xl transition cursor-pointer shadow-lg shadow-green-900/20"
                >
                  2. One-Click Deploy (Pin + Deploy)
                </button>
              </>
            ) : (
              <button
                onClick={handleCustomDeploy}
                disabled={isDeploying}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white font-bold py-4 px-4 rounded-xl transition shadow-lg shadow-purple-600/20"
              >
                Deploy Custom Collection on Base
              </button>
            )}
          </div>

        </div>

        {/* Right Column: Preview or Checklist */}
        <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800">
          {activeMode === "ai" ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-200">Collection Preview</h2>
                {previewItems.length > 0 && (
                  <span className="text-xs font-mono bg-blue-900/40 text-blue-400 border border-blue-800 px-2.5 py-1 rounded-full">
                    {previewItems.length} NFTs Generated
                  </span>
                )}
              </div>

              {previewItems.length === 0 ? (
                <div className="h-80 flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-xl text-gray-500">
                  <p>Configure details and click "1. Generate AI Preview"</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                  {previewItems.map((item) => (
                    <div
                      key={item.tokenId}
                      className="bg-gray-800/90 border border-gray-700/80 rounded-2xl overflow-hidden flex flex-col shadow-lg transition hover:border-gray-600"
                    >
                      <div className="px-3 py-2 bg-gray-900/80 border-b border-gray-700/50 flex justify-between items-center">
                        <span className="font-mono text-xs font-black text-gray-200">#{item.tokenId}</span>
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                            item.tier === "Mythic"
                              ? "bg-purple-950/80 text-purple-300 border-purple-500/50"
                              : item.tier === "Legendary"
                              ? "bg-amber-950/80 text-amber-300 border-amber-500/50"
                              : item.tier === "Epic"
                              ? "bg-pink-950/80 text-pink-300 border-pink-500/50"
                              : item.tier === "Rare"
                              ? "bg-blue-950/80 text-blue-300 border-blue-500/50"
                              : item.tier === "Uncommon"
                              ? "bg-green-950/80 text-green-300 border-green-500/50"
                              : "bg-gray-800 text-gray-300 border-gray-600"
                          }`}
                        >
                          {item.tier}
                        </span>
                      </div>
                      <div className="relative aspect-square bg-gray-950 overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.metadata?.name || `NFT #${item.tokenId}`}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                      </div>
                      <div className="p-3 bg-gray-900/40 flex-1 space-y-2">
                        <p className="text-xs font-bold text-gray-200 truncate">
                          {item.metadata?.name || `Token #${item.tokenId}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🗂️</span>
                <h2 className="text-xl font-bold text-gray-200">Custom Art Checklist</h2>
              </div>
              
              <div className="space-y-6 text-sm text-gray-300">
                <div className="bg-gray-950 border border-gray-800 p-5 rounded-xl shadow-inner">
                  <h3 className="font-bold text-purple-400 mb-2 text-base">1. Prepare your Metadata</h3>
                  <p className="leading-relaxed">
                    Your folder must contain sequentially numbered JSON files (<code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-200 font-mono">1.json</code>, <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-200 font-mono">2.json</code>) adhering to the standard ERC-721 format.
                  </p>
                </div>

                <div className="bg-gray-950 border border-gray-800 p-5 rounded-xl shadow-inner">
                  <h3 className="font-bold text-purple-400 mb-2 text-base">2. Pin to IPFS</h3>
                  <p className="leading-relaxed">
                    Upload your entire metadata folder to an IPFS pinning service like <strong>Pinata</strong> or <strong>NFT.Storage</strong>.
                  </p>
                  <a href="https://pinata.cloud/" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline mt-3 inline-block font-bold">
                    Open Pinata ↗
                  </a>
                </div>

                <div className="bg-gray-950 border border-gray-800 p-5 rounded-xl shadow-inner">
                  <h3 className="font-bold text-purple-400 mb-2 text-base">3. Set Your Base URI</h3>
                  <p className="leading-relaxed">
                    Paste the CID hash generated by Pinata into the form to the left. It will be bound to your contract at the exact moment of deployment.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}