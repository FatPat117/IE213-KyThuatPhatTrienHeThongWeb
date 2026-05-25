import type { Metadata } from "next";
import {
    Geist,
    Geist_Mono,
    Inter,
    JetBrains_Mono,
    Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { AuthProvider, NetworkStatusMonitor, StatusProvider, WagmiProviderWrapper } from "@/lib";
import { SystemStatusDisplay } from "@/components/system/SystemStatusDisplay";
import { NetworkAccessGuard } from "@/components/system/NetworkAccessGuard";
import Header from "@/components/layout/Header";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "optional",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "optional",
});

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin", "vietnamese"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

const spaceGrotesk = Space_Grotesk({
    variable: "--font-space-grotesk",
    subsets: ["latin", "vietnamese"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
    adjustFontFallback: true,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
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
      <head>
        <link rel="preconnect" href="https://rpc.sepolia.org" />
        <link rel="preconnect" href="http://localhost:4000" />
      </head>
      <body
        className={`app-luxury ${geistSans.variable} ${geistMono.variable} ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-body min-h-screen antialiased`}
      >
        <WagmiProviderWrapper>
          <AuthProvider>
            <StatusProvider>
              <SystemStatusDisplay />
              <NetworkStatusMonitor />
              <NetworkAccessGuard />
              <Header />
              <Toaster
                position="top-right"
                gutter={8}
                containerStyle={{
                  top: "1rem",
                  right: "0.75rem",
                  zIndex: 9990,
                  pointerEvents: "none",
                }}
                toastOptions={{
                  duration: 4000,
                  style: {
                    zIndex: 10000,
                    background: "transparent",
                    boxShadow: "none",
                    padding: 0,
                    pointerEvents: "auto",
                  },
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
