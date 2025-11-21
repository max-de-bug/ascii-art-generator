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
            <div className="w-10 h-10 rounded bg-muted border border-border flex items-center justify-center overflow-hidden">              <Image
                src="/pixel_art_large.png"
                alt="ASCII Art Generator Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <h1 className="m-0">
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
