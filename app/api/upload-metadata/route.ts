import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, name, description, samplePrompt, rarityMatrix } = body;

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json({ error: "Pinata JWT not configured" }, { status: 500 });
    }

    // SCENARIO 1: Home Dashboard (Studio) - Single Contract Blueprint Metadata
    if (!items) {
      if (!name) return NextResponse.json({ error: "No data provided" }, { status: 400 });

      const contractMetadata = {
        name: name,
        description: description || "A BasedRick Studio Collection",
        image: "ipfs://QmDefaultPlaceholderHash",
        samplePrompt: samplePrompt,
        rarityMatrix: rarityMatrix
      };

      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        {
          pinataContent: contractMetadata,
          pinataMetadata: { name: `${name.replace(/\s+/g, '_')}_Blueprint.json` }
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${pinataJwt}`,
          },
        }
      );

      const cid = response.data.IpfsHash;
      return NextResponse.json({ success: true, cid, baseUri: `ipfs://${cid}/` });
    }

    // SCENARIO 2: Launchpad Create Page - Full Collection Folder
    if (items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const boundary = "basedrick-ipfs-boundary";
    let data = "";

    items.forEach((item: any, index: number) => {
      const tokenId = item.tokenId || index + 1;

      const metadataJson = JSON.stringify({
        name: item.metadata.name,
        description: item.metadata.description,
        image: item.metadata.image,
        attributes: item.metadata.attributes || [],
      });

      data += `--${boundary}\r\n`;
      data += `Content-Disposition: form-data; name="file"; filename="metadata/${tokenId}"\r\n`;
      data += `Content-Type: application/json\r\n\r\n`;
      data += `${metadataJson}\r\n`;
    });

    data += `--${boundary}--\r\n`;

    const response = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", data, {
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${pinataJwt}`,
      },
    });

    const cid = response.data.IpfsHash;
    const baseUri = `ipfs://${cid}/`;

    return NextResponse.json({ success: true, cid, baseUri });

  } catch (error: any) {
    console.error("IPFS Upload Error:", error.response?.data || error.message);
    return NextResponse.json({ error: "Failed to upload metadata" }, { status: 500 });
  }
}