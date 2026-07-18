import { Link } from "@tanstack/react-router";

import { ModeToggle } from "./mode-toggle";

export default function Header() {
  return (
    <header className="relative z-30 border-b border-white/8 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl flex-row items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="group flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
          aria-label="Beat It home"
        >
          <span className="brand-mark">BI</span>
          <span className="brand-display text-base tracking-[-0.04em] uppercase">
            Beat It
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Runs locally
          </span>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
