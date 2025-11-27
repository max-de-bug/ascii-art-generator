"use client";

import Link from "next/link";
import { toast } from "sonner";

export const Navbar = () => {
  const handleComingSoon = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    toast.info("Soon");
  };
  return (
    <nav className="ml-6">
      <ul className="flex items-center gap-4">
        <li>
          <Link
            href="/profile"
            className="text-lg font-bold text-muted-foreground "
            style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
          >
            Profile
          </Link>
        </li>
        <li>
          <Link
            href="/leaderboard"
            onClick={handleComingSoon}
            className="text-lg font-bold text-muted-foreground hover:text-foreground transition-colors cursor-not-allowed opacity-50"
            style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
            aria-disabled="true"
            tabIndex={-1}
          >
            Leaderboard
          </Link>
        </li>
        <li>
          <Link
            href="/explore"
            onClick={handleComingSoon}
            className="text-lg font-bold text-muted-foreground hover:text-foreground transition-colors cursor-not-allowed opacity-50"
            style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
            aria-disabled="true"
            tabIndex={-1}
          >
          Explore
          </Link>
        </li>
      </ul>
    </nav>
  );
};
