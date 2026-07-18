import { Link } from "@tanstack/react-router";

export default function Header() {
  return (
    <header className="poster-ground relative z-30">
      <div className="mx-auto flex h-14 max-w-7xl flex-row items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="group flex items-center gap-2.5 rounded-md outline-none focus-visible:outline-3 focus-visible:outline-[var(--booth-blue)]"
          aria-label="Beat It home"
        >
          <span className="brand-mark">BI</span>
          <span className="brand-display text-base uppercase">Beat It</span>
        </Link>
        <span className="hidden items-center gap-2 text-[0.68rem] font-extrabold tracking-wide uppercase opacity-60 sm:flex">
          <span className="size-1.5 rounded-full bg-[var(--glove)]" />
          Runs locally
        </span>
      </div>
      <div className="hazard-tape" aria-hidden="true" />
    </header>
  );
}
