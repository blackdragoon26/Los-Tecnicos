import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/ui/Navbar";
import AppInitializer from "@/components/AppInitializer";
import LiquidChrome from "@/components/ui/LiquidChrome";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Los Tecnicos | Decentralized P2P Energy Trading",
  description: "A futuristic marketplace for community-driven renewable energy trading on the Stellar blockchain.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
            <LiquidChrome
              baseColor={[0.05, 0.07, 0.1]}
              speed={0.1}
              amplitude={0.2}
              frequencyX={4}
              frequencyY={4}
              interactive={true}
            />
        </div>
        <AppInitializer>
          <Navbar />
          <main className="min-h-screen">
            {children}
          </main>
        </AppInitializer>
      </body>
    </html>
  );
}
