import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Pixelify_Sans, Press_Start_2P } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./Components/Providers/theme-provider";
import { NetworkProvider } from "./Components/Providers/network-provider";
import { WalletContextProvider } from "./Components/Providers/wallet-provider";
import { QueryProvider } from "./Components/Providers/query-provider";

import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const pixelifySans = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const pressStart2P = Press_Start_2P({
  variable: "--font-press-start",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "ASCII Art generator",
  description: "ASCII Art generator on solana",
  icons: {
    icon: [
      { url: "/Logo_Black-modified.png", type: "image/png" },
    ],
    apple: [
      { url: "/Logo_Black-modified.png", type: "image/png" },
    ],
    shortcut: "/Logo_Black-modified.png",
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
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${pixelifySans.variable} ${pressStart2P.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
          <NetworkProvider>
            <WalletContextProvider>{children}</WalletContextProvider>
          </NetworkProvider>
          </QueryProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
