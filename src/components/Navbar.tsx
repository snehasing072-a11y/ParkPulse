interface NavbarProps {
  onSearchClick: () => void;
}

export function Navbar({ onSearchClick }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-6 py-4">
        <a
          href="#top"
          className="whitespace-nowrap shrink-0 text-xl font-bold tracking-tight text-[#101828]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Park<span className="text-[#00B8C8]">Pulse</span>
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <a
            href="#how-it-works"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#101828]"
          >
            How It Works
          </a>
          <a
            href="#features"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#101828]"
          >
            Features
          </a>
          <a
            href="#benefits"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#101828]"
          >
            Benefits
          </a>
          <a
            href="#lot-directory"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#101828]"
          >
            Seeded Lots
          </a>
          <a
            href="#pipeline"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#101828]"
          >
            Data Pipeline
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onSearchClick}
            className="whitespace-nowrap shrink-0 rounded-lg bg-[#101828] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1D2939] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D4E5]"
          >
            Search Parking
          </button>
        </div>
      </div>
    </header>
  );
}
