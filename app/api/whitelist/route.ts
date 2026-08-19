// app/api/whitelist/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { addresses, contractAddress } = await req.json();
    
    const pinataPayload = {
      pinataOptions: { cidVersion: 1 },
      pinataMetadata: {
        name: `Whitelist_${contractAddress}`,
        keyvalues: { contractAddress: contractAddress.toLowerCase() }
      },
      pinataContent: { addresses }
    };

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.PINATA_JWT}` 
      },
      body: JSON.stringify(pinataPayload),
    });
    
    const data = await res.json();
    return NextResponse.json({ success: true, cid: data.IpfsHash });
  } catch (error) {
    console.error("IPFS Upload Error:", error);
    return NextResponse.json({ success: false, error: "Upload failed" });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const contractAddress = searchParams.get("contractAddress")?.toLowerCase();

    if (!contractAddress) return NextResponse.json({ success: false, error: "No address provided" });

    const searchRes = await fetch(
      `https://api.pinata.cloud/data/pinList?metadata[keyvalues][contractAddress]={"value":"${contractAddress}","op":"eq"}&status=pinned`, 
      { headers: { "Authorization": `Bearer ${process.env.PINATA_JWT}` } }
    );
    
    const searchData = await searchRes.json();
    
    if (searchData.count === 0 || !searchData.rows || searchData.rows.length === 0) {
      return NextResponse.json({ success: true, addresses: [] });
    }

    const latestCid = searchData.rows[0].ipfs_pin_hash; 
    
    const fileRes = await fetch(`https://gateway.pinata.cloud/ipfs/${latestCid}`);
    const fileData = await fileRes.json();

    return NextResponse.json({ success: true, addresses: fileData.addresses });
  } catch (error) {
    console.error("IPFS Fetch Error:", error);
    return NextResponse.json({ success: false, error: "Fetch failed" });
  }
}