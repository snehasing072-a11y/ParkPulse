export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <div className="mx-auto flex max-w-[1200px] flex-col justify-between gap-6 px-6 sm:flex-row sm:items-center">
        <div>
          <p
            className="text-base font-bold tracking-tight text-[#101828]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Park<span className="text-[#00B8C8]">Pulse</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Greater Noida parking intelligence pilot · Occupancy feedback is not a slot reservation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
          <a href="#how-it-works" className="hover:text-[#101828]">
            How It Works
          </a>
          <a href="#features" className="hover:text-[#101828]">
            Features
          </a>
          <a href="#lot-directory" className="hover:text-[#101828]">
            Seeded Lots
          </a>
          <a href="#pipeline" className="hover:text-[#101828]">
            Data Pipeline
          </a>
        </div>
      </div>
    </footer>
  );
}
