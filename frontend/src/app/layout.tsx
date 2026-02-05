import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WagmiProviderWrapper, StatusProvider, NetworkStatusMonitor } from "@/lib";
import { SystemStatusDisplay } from "@/components/system/SystemStatusDisplay";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FundRaising DApp",
  description: "Ethereum-based fundraising application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WagmiProviderWrapper>
          <StatusProvider>
            <SystemStatusDisplay />
            <NetworkStatusMonitor />
            {children}
          </StatusProvider>
        </WagmiProviderWrapper>
      </body>
    </html>
  );
}
