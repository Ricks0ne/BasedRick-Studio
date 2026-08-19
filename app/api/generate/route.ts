import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, name, description, basePrompt, totalSupply, rarityTiers } = body;

    // 1. Single Prompt Concept (Home Studio Flow)
    if (prompt && !totalSupply && !basePrompt) {
      const collectionName = prompt.trim();
      
      let styleGuide = `A unique digital asset collection themed around ${prompt}, built on the Base network.`;
      let samplePrompt = `${prompt}, high detail, cyberpunk aesthetic, vibrant lighting`;

      try {
        const loreRes = await axios.get(
          `https://text.pollinations.ai/Write a short 2-sentence creative lore description for an NFT collection themed around: ${encodeURIComponent(prompt)}`
        );
        if (loreRes.data) styleGuide = String(loreRes.data).trim();

        const promptRes = await axios.get(
          `https://text.pollinations.ai/Write an ultra-detailed 8K artwork prompt for an NFT character themed around: ${encodeURIComponent(prompt)}. Return ONLY the prompt text.`
        );
        if (promptRes.data) samplePrompt = String(promptRes.data).trim();
      } catch (e) {
        // Fallback gracefully if text API hiccups
      }

      const rarityMatrix = {
        Common: "55%",
        Rare: "25%",
        Platinum: "15%",
        Mythic: "5%"
      };

      return NextResponse.json({
        success: true,
        data: {
          styleGuide,
          samplePrompt,
          rarityMatrix,
          specs: {
            name: collectionName.slice(0, 20) || "Based Collection",
            symbol: "BRICK"
          }
        }
      });
    }

    // 2. Collection Matrix Generation (Launchpad Create Flow)
    const activePrompt = basePrompt || prompt || "Based Cyber Rick";
    const collectionName = name || "Based Collection";

    // Style & visual trait mappings per rarity tier
    const tierStyles: Record<string, { style: string; powerLevel: string; aura: string }> = {
      Mythic: {
        style: "transcendent cosmic celestial energy, otherworldly divine essence, hyper-detailed 8k masterpiece",
        powerLevel: "God-Tier",
        aura: "Cosmic Iridescent"
      },
      Legendary: {
        style: "hyper-advanced cybernetic armor, golden particle aura, ornate futuristic detailing",
        powerLevel: "Elite Overclocked",
        aura: "Golden Neon"
      },
      Epic: {
        style: "heavy cybernetic enhancements, holographic visor, glowing power surges",
        powerLevel: "Overpowered",
        aura: "Electric Purple"
      },
      Rare: {
        style: "tactical techwear, glowing accent lines, neon rim reflections",
        powerLevel: "Enhanced",
        aura: "Vibrant Cyan"
      },
      Uncommon: {
        style: "custom combat jacket, augmented eye scanner, stylized background",
        powerLevel: "Standard Augmented",
        aura: "Emerald Green"
      },
      Common: {
        style: "clean studio background, standard attire, crisp digital render",
        powerLevel: "Base",
        aura: "None"
      }
    };

    // Flatten custom user distribution: { Common: 5, Rare: 2 } -> ["Common", "Common", "Common", "Common", "Common", "Rare", "Rare"]
    let exactTiers: string[] = [];
    if (rarityTiers && typeof rarityTiers === "object") {
      for (const [tier, count] of Object.entries(rarityTiers)) {
        for (let i = 0; i < Number(count); i++) {
          exactTiers.push(tier);
        }
      }
    }

    // Fallback if rarity distribution was empty
    if (exactTiers.length === 0) {
      const count = Number(totalSupply) || 10;
      for (let i = 0; i < count; i++) exactTiers.push("Common");
    }

    // Randomize tier distribution so token IDs aren't sequential by rarity
    exactTiers = exactTiers.sort(() => Math.random() - 0.5);

    const items = exactTiers.map((tierName, index) => {
      const tokenId = index + 1;
      const tierConfig = tierStyles[tierName] || tierStyles.Common;
      
      const seed = Math.floor(1000 + Math.random() * 900000);
      const fullPrompt = `${activePrompt}, ${tierConfig.style}, seed ${seed}`;
      
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=512&height=512&seed=${seed}&nologo=true`;

      const itemDescription = description 
        ? `${description} - ${tierName} Edition #${tokenId}`
        : `A unique ${tierName} digital asset from ${collectionName} featuring ${activePrompt}.`;

      const attributes = [
        { trait_type: "Rarity Tier", value: tierName },
        { trait_type: "Base Concept", value: activePrompt.slice(0, 30) },
        { trait_type: "Power Level", value: tierConfig.powerLevel },
        { trait_type: "Aura", value: tierConfig.aura },
        { trait_type: "Seed", value: seed.toString() }
      ];

      return {
        tokenId,
        tier: tierName,
        prompt: fullPrompt,
        imageUrl,
        metadata: {
          name: `${collectionName} #${tokenId}`,
          description: itemDescription,
          image: imageUrl,
          attributes
        }
      };
    });

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to generate collection" }, { status: 500 });
  }
}