import FactoryData from "./LaunchpadFactory.json";
import LaunchpadData from "./BasedRickLaunchpad.json";
import MarketplaceData from "./BasedRickMarketplace.json";

export const LAUNCHPAD_FACTORY_ABI = FactoryData.abi as const;
export const BASEDRICK_LAUNCHPAD_ABI = LaunchpadData.abi as const;
export const MARKETPLACE_ABI = MarketplaceData.abi as const;

// Contract Addresses (Base Sepolia)
export const LAUNCHPAD_FACTORY_ADDRESS =
  "0x66E16D8B540Ad20834b6f0a8115C8C039353F5bE" as `0x${string}`;

// ⚡ UPDATED to the new Marketplace with Expirations
export const MARKETPLACE_ADDRESS =
  "0x0E203E4Af9351849EE2C30d812b83c5852387445" as `0x${string}`;



