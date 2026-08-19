import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json({ error: "Pinata JWT not configured" }, { status: 500 });
    }

    const boundary = "basedrick-ipfs-boundary";
    let data = "";

    items.forEach((item: any, index: number) => {
      const tokenId = item.tokenId || index + 1;

      // Clean ERC-721 Metadata output
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

    return NextResponse.json({
      success: true,
      cid,
      baseUri,
    });
  } catch (error: any) {
    console.error("IPFS Upload Error:", error.response?.data || error.message);
    return NextResponse.json({ error: "Failed to upload to IPFS" }, { status: 500 });
  }
}