import Link from "next/link";
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
            <div className="w-10 h-10 rounded bg-linear-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">
                {"<>"}
              </span>
            </div>
            <h1 className="m-0">
              <Link href="/" className="text-2xl font-bold">
                ASCII Art Generator
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
