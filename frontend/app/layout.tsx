import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SolanaWalletProvider } from "@/components/solana-wallet-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FluxAPI - Decentralized API Marketplace",
  description:
    "The ultimate marketplace for blockchain-powered APIs. Monetize your APIs with Solana payments.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SolanaWalletProvider>
          {children}
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
