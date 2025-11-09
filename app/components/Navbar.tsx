import Link from "next/link";

export const Navbar = () => {
  return (
    <nav className="ml-6">
      <ul className="flex items-center gap-4">
        <li>
          <Link
            href="/profile"
            className="text-lg font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Profile
          </Link>
        </li>
        <li>
          <Link
            href="/marketplace"
            className="text-lg font-semibold text-muted-foreground/50 cursor-not-allowed pointer-events-none"
            aria-disabled="true"
            tabIndex={-1}
          >
            Marketplace
          </Link>
        </li>
      </ul>
    </nav>
  );
};
