import Link from "next/link";
import Image from "next/image";
import { ModeToggle } from "./mode-toggle";
import { WalletButton } from "./WalletButton";
import { Navbar } from "./Navbar";
import { ToggleNetworkButton } from "./ToggleNetworkButton";

export function Header() {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur">
      <div className=" mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-muted border border-border flex items-center justify-center overflow-hidden relative group">
              {/* Continuous subtle glow */}
              <div className="absolute inset-0 rounded bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-50 animate-shimmer" />
              {/* Enhanced glow on hover */}
              <div className="absolute inset-0 rounded bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 animate-shimmer transition-opacity duration-300" />
              <Image
                src="/pixel_art_large.png"
                alt="ASCII Art Generator Logo"
                width={40}
                height={40}
                className="object-contain relative z-10 transition-all duration-300 group-hover:brightness-110 group-hover:drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]"
              />
            </div>
            <h1 className="m-0 hover:text-primary transition-colors duration-300 cursor-pointer">
              <Link href="/" className="text-2xl font-bold" style={{ fontFamily: "Retro-computer, 'Courier New', monospace", fontWeight: 700, fontSize: "1.25rem" }}>
                O.ASCII Art Generator
              </Link>
            </h1>
            <Navbar />
          </div>
          <div className="flex items-center gap-3">
            <ToggleNetworkButton />
            <WalletButton />
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
