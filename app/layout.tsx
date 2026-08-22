import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BasedRick | AI NFT Studio",
  description: "Generate and launch NFT collections on Base using AI.",
  other: {
    "base:app_id": "6a893d7c39d7d26f4bad174f",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`${inter.className} bg-gray-950 text-white min-h-screen`}
        suppressHydrationWarning
      >
        <Providers>
          <Navbar />
          {children}
          <Toaster 
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#111827', // Tailwind gray-900
                color: '#fff',
                border: '1px solid #1f2937', // Tailwind gray-800
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 'bold'
              },
              success: {
                iconTheme: {
                  primary: '#10b981', // Emerald 500
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444', // Red 500
                  secondary: '#fff',
                },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}