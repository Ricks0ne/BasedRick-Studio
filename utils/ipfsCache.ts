// Layer 1: In-Memory RAM Cache (Instant 0ms loads across route changes)
const memoryCache = new Map<string, any>();

export const resolveIpfsUrl = (url?: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://")) {
    // Primary fast gateway
    return url.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
  }
  return url;
};

export const fetchMetadataWithCache = async (uri: string) => {
  if (!uri) return null;

  // ⚡ 1. Check RAM Cache (0ms load)
  if (memoryCache.has(uri)) {
    return memoryCache.get(uri);
  }

  // ⚡ 2. Check Browser Session Storage (Survives page refresh)
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(`nft_meta_${uri}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        memoryCache.set(uri, parsed); // Sync back to RAM
        return parsed;
      }
    } catch (err) {
      console.error("Session storage read error", err);
    }
  }

  // 🌐 3. Network Fetch (Only runs if completely uncached)
  let data = null;
  if (!uri.startsWith("ipfs://")) {
    const res = await fetch(uri);
    data = await res.json();
  } else {
    const cidPath = uri.replace("ipfs://", "");
    // Multi-gateway fallback to guarantee we find it
    const gateways = [
      "https://gateway.pinata.cloud/ipfs/",
      "https://dweb.link/ipfs/",
      "https://ipfs.io/ipfs/"
    ];
    
    for (const gateway of gateways) {
      try {
        const res = await fetch(`${gateway}${cidPath}`);
        if (res.ok) {
          data = await res.json();
          break; // Stop fetching once we succeed
        }
      } catch (e) {
        continue;
      }
    }
  }

  if (!data) throw new Error("All IPFS gateways failed.");

  // 💾 4. Save to Caches for next time
  memoryCache.set(uri, data);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`nft_meta_${uri}`, JSON.stringify(data));
    } catch (err) {
      console.error("Session storage write error", err);
    }
  }

  return data;
};