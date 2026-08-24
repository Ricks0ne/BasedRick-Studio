import { http, fallback } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Import injectedWallet, which safely catches any EVM extension
import { 
  injectedWallet, 
  walletConnectWallet 
} from '@rainbow-me/rainbowkit/wallets';

export const config = getDefaultConfig({
  appName: 'BasedRick NFT Studio',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID as string,
  chains: [baseSepolia],
  ssr: true,
  wallets: [
    {
      groupName: 'Supported Wallets',
      wallets: [
        injectedWallet,      // 👈 The universal fix for extension conflicts
        walletConnectWallet
      ],
    },
  ],
  transports: {
    // 👇 Pure public RPCs. No Alchemy.
    [baseSepolia.id]: fallback([
      http('https://base-sepolia-rpc.publicnode.com'), // Primary high-limit public RPC
      http('https://sepolia.base.org')                 // Official Base fallback
    ]),
  },
});