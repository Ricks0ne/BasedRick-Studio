import { http, fallback } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Import injectedWallet, which safely catches any EVM extension
import { 
  injectedWallet, 
  metaMaskWallet, 
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
        metaMaskWallet, 
        walletConnectWallet
      ],
    },
  ],
  transports: {
    // 👇 Your dedicated Base API Key goes first, with public nodes as safety fallbacks
    [baseSepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_BASE_RPC_URL),      // ⚡ Your dedicated RPC
      http('https://base-sepolia-rpc.publicnode.com'), // Public fallback 1
      http('https://sepolia.base.org')                 // Public fallback 2
    ]),
  },
});