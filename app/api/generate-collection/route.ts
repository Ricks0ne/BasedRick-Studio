import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { name, description, basePrompt, totalSupply } = await req.json();

    const rarityTiers = [
      { tier: "Mythic", weight: 0.05, style: "transcendent iridescent cosmic aura, ultra-detailed" },
      { tier: "Legendary", weight: 0.15, style: "gold trim, cybernetic enhancements, hyper-realistic" },
      { tier: "Rare", weight: 0.25, style: "neon ambient rim lighting, vibrant color palette" },
      { tier: "Common", weight: 0.55, style: "clean studio lighting, crisp digital render" },
    ];

    const items = [];

    for (let i = 1; i <= Number(totalSupply); i++) {
      const rand = Math.random();
      let cumulative = 0;
      let selectedTier = rarityTiers[3];

      for (const t of rarityTiers) {
        cumulative += t.weight;
        if (rand <= cumulative) {
          selectedTier = t;
          break;
        }
      }

      const seed = Math.floor(1000 + Math.random() * 9000);
      const fullPrompt = `${basePrompt}, ${selectedTier.style}, seed ${seed}`;
      
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=512&height=512&seed=${seed}&nologo=true`;

      const itemDescription = description || `A unique ${selectedTier.tier} NFT from ${name} featuring ${basePrompt}.`;

      const attributes = [
        { trait_type: "Rarity Tier", value: selectedTier.tier },
        { trait_type: "Base Concept", value: basePrompt },
        { trait_type: "Lighting & Style", value: selectedTier.style.split(",")[0] },
        { trait_type: "Seed", value: seed.toString() },
      ];

      items.push({
        tokenId: i,
        tier: selectedTier.tier,
        prompt: fullPrompt,
        imageUrl,
        metadata: {
          name: `${name} #${i}`,
          description: itemDescription,
          image: imageUrl,
          attributes,
        },
      });
    }

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error("Collection Gen Error:", error);
    return NextResponse.json({ error: "Failed to generate collection" }, { status: 500 });
  }
}