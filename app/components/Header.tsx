import Link from "next/link";
import { ModeToggle } from "./mode-toggle";
import { WalletButton } from "./WalletButton";

export function Header() {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-linear-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">
                {"<>"}
              </span>
            </div>
            <h1>
              <Link href="/" className="text-2xl font-bold">
                ASCII Art Generator
              </Link>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <WalletButton />
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
