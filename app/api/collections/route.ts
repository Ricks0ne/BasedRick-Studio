import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "collections.json");

interface CollectionRecord {
  owner: string;
  address: string;
  name: string;
  symbol: string;
  baseUri?: string;
  maxSupply?: number;
  publicPrice?: string;
  whitelistPrice?: string;
  createdAt: number;
}

function readCollectionsFromFile(): CollectionRecord[] {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([]));
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("Error reading collections file:", err);
    return [];
  }
}

function writeCollectionsToFile(data: CollectionRecord[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing collections file:", err);
  }
}

// GET /api/collections
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner");
    const all = readCollectionsFromFile();

    if (!owner) {
      return NextResponse.json({ success: true, collections: all.slice().reverse() });
    }

    const filtered = all.filter(
      (item) => item.owner.toLowerCase() === owner.toLowerCase()
    );

    return NextResponse.json({ success: true, collections: filtered.slice().reverse() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/collections
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { owner, address, name, symbol, baseUri, maxSupply, publicPrice, whitelistPrice } = body;

    if (!owner || !address || !name) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const all = readCollectionsFromFile();
    const existingIndex = all.findIndex(
      (c) => c.address.toLowerCase() === address.toLowerCase()
    );

    const record: CollectionRecord = {
      owner: owner.toLowerCase(),
      address,
      name,
      symbol: symbol || "NFT",
      baseUri: baseUri || "",
      maxSupply: Number(maxSupply) || 0,
      publicPrice: publicPrice || "0",
      whitelistPrice: whitelistPrice || "0",
      createdAt: Date.now(),
    };

    if (existingIndex >= 0) {
      all[existingIndex] = { ...all[existingIndex], ...record };
    } else {
      all.push(record);
    }

    writeCollectionsToFile(all);

    return NextResponse.json({ success: true, message: "Saved to persistent storage" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}