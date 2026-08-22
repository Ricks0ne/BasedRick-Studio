import FactoryData from "./LaunchpadFactory.json";
import LaunchpadData from "./BasedRickLaunchpad.json";
import MarketplaceData from "./BasedRickMarketplace.json";

export const LAUNCHPAD_FACTORY_ABI = FactoryData.abi as const;
export const BASEDRICK_LAUNCHPAD_ABI = LaunchpadData.abi as const;
export const MARKETPLACE_ABI = MarketplaceData.abi as const;

// ⚡ Contract Addresses (Base Sepolia)
export const LAUNCHPAD_FACTORY_ADDRESS =
  "0x253FC033d3639A2d1df017685dB4837aC8C34a2B" as `0x${string}`;

export const MARKETPLACE_ADDRESS =
  "0x588E5805e3Db9e42F4669a016D9d248F365b2db2" as `0x${string}`;

export const LAUNCHPAD_IMPLEMENTATION_ADDRESS =
  "0xBC5bE44D2BA497c8dD07Ca382252b882CBee569e" as `0x${string}`;