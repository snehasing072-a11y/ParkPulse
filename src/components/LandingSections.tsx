const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Search Destination & Arrival',
    description:
      'Enter your Greater Noida destination, arrival time, vehicle type, walking tolerance, and priority preference.',
  },
  {
    step: '02',
    title: 'Predict Occupancy Ahead',
    description:
      'ParkPulse combines cleaned historical occupancy patterns with time-aware forecasts and confidence intervals.',
  },
  {
    step: '03',
    title: 'Rank & Recommend Clearly',
    description:
      'Eligible lots are scored across availability, walking distance, and hourly fee with plain-language reasoning.',
  },
  {
    step: '04',
    title: 'Navigate & Share Feedback',
    description:
      'Follow turn-by-turn routes and submit non-reservation check-in/out occupancy feedback to improve accuracy.',
  },
];

const KEY_FEATURES = [
  {
    title: 'Honest Availability Labeling',
    description:
      'Every slot count displays whether it is Live, Predicted, Baseline, or Unknown. Simulated history is never disguised as live sensor telemetry.',
  },
  {
    title: 'Greater Noida Coverage',
    description:
      'Seeded across Pari Chowk, Alpha 1 & 2, Beta 1 & 2, Gamma 1, Knowledge Park II & III, Site IV malls, and Metro transit lots.',
  },
  {
    title: 'Validated Data Pipeline',
    description:
      'Raw occupancy logs pass through schema validation, deduplication, missing-value interpolation, and rate normalisation before modeling.',
  },
  {
    title: 'Vehicle & Hours Enforcement',
    description:
      'Car-only multi-level decks, bike-only metro stands, and night-closing markets are tracked explicitly so you never arrive at a locked gate.',
  },
];

const BENEFITS = [
  {
    metric: '18',
    unit: 'Greater Noida lots',
    detail: 'Covering markets, malls, IT offices, university campuses, and metro stations.',
  },
  {
    metric: '42 days',
    unit: '15-minute intervals',
    detail: 'Six weeks of weekday/weekend simulated occupancy patterns per lot.',
  },
  {
    metric: '100%',
    unit: 'Source transparency',
    detail: 'Clear distinction between verified live telemetry, predictions, and simulated baselines.',
  },
];

export function LandingSections() {
  return (
    <>
      <section id="how-it-works" className="border-t border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-[#101828] sm:text-3xl">
              How ParkPulse Works
            </h2>
            <p className="mt-2.5 text-base text-slate-600">
              Built around an end-to-end decision loop from search validation to post-trip occupancy feedback.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS_STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-slate-200 bg-[#F5F7FA] p-6 transition-colors hover:border-slate-300"
              >
                <span className="font-mono text-xs font-semibold text-[#0099A8] tabular-nums">
                  {item.step}
                </span>
                <h3 className="mt-3 text-base font-semibold text-[#101828]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-slate-200 bg-[#F5F7FA] py-16 sm:py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-4">
              <h2 className="text-2xl font-bold tracking-tight text-[#101828] sm:text-3xl">
                Key Platform Features
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Every availability figure carries its data provenance, and check-in/check-out actions act purely as occupancy feedback rather than guaranteed slot reservations.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-8">
              {KEY_FEATURES.map((feat) => (
                <div
                  key={feat.title}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
                >
                  <h3 className="text-base font-semibold text-[#101828]">{feat.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{feat.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="benefits" className="border-t border-slate-200 bg-[#101828] py-16 text-white sm:py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Built for Confident Urban Arrivals
            </h2>
            <p className="mt-2.5 text-sm text-slate-300">
              Eliminate circling around Pari Chowk and Knowledge Park with transparent occupancy modeling.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <div
                key={b.unit}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
              >
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-3xl font-bold text-[#00D4E5] tabular-nums">
                    {b.metric}
                  </span>
                  <span className="text-sm font-medium text-slate-200">{b.unit}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{b.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
