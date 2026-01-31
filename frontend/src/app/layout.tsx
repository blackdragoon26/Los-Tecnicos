import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/ui/Navbar";
import EnergyBackground from "@/components/three/EnergyBackground";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EnergyGrid | Decentralized P2P Energy Trading",
  description: "A futuristic marketplace for community-driven renewable energy trading on Stellar blockchain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <EnergyBackground />
        <main className="pt-24 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
