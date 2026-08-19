import { http } from 'wagmi';
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
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
});