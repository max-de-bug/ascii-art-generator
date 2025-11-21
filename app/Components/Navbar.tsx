import Link from "next/link";

export const Navbar = () => {
  return (
    <nav className="ml-6">
      <ul className="flex items-center gap-4">
        <li>
          <Link
            href="/profile"
            className="text-lg font-bold text-muted-foreground hover:text-foreground transition-colors"
            style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
          >
            Profile
          </Link>
        </li>
        <li>
          <Link
            href="/leaderboard"
            className="text-lg font-bold text-muted-foreground hover:text-foreground transition-colors cursor-not-allowed pointer-events-none opacity-50"
            style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
            aria-disabled="true"
            tabIndex={-1}
          >
            Leaderboard
          </Link>
        </li>
      </ul>
    </nav>
  );
};
