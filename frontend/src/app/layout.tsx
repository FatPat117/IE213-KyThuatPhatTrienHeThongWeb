import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider, NetworkStatusMonitor, StatusProvider, WagmiProviderWrapper } from "@/lib";
import { SystemStatusDisplay } from "@/components/system/SystemStatusDisplay";
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
              <Header />
              <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
              {children}
            </StatusProvider>
          </AuthProvider>
        </WagmiProviderWrapper>
      </body>
    </html>
  );
}
