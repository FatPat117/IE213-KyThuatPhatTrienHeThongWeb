import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider, NetworkStatusMonitor, StatusProvider, WagmiProviderWrapper } from "@/lib";
import { SystemStatusDisplay } from "@/components/system/SystemStatusDisplay";
import { NetworkAccessGuard } from "@/components/system/NetworkAccessGuard";
import Header from "@/components/layout/Header";
import { Toaster } from "react-hot-toast";

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
          <AuthProvider>
            <StatusProvider>
              <SystemStatusDisplay />
              <NetworkStatusMonitor />
              <NetworkAccessGuard />
              <Header />
              <Toaster
                position="top-center"
                containerStyle={{
                  top: "7.5rem",
                  zIndex: 10000,
                }}
                toastOptions={{
                  duration: 4000,
                  style: { zIndex: 10000 },
                }}
              />
              {children}
            </StatusProvider>
          </AuthProvider>
        </WagmiProviderWrapper>
      </body>
    </html>
  );
}
