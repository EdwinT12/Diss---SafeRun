const PIPELINE_STEPS = [
  { step: 1, label: 'Fetching Crime Data', icon: '01' },
  { step: 2, label: 'Kernel Density Estimation', icon: '02' },
  { step: 3, label: 'Spatial Statistics', icon: '03' },
  { step: 4, label: 'Environmental Analysis', icon: '04' },
  { step: 5, label: 'Graph Routing (Dijkstra/A*)', icon: '05' },
  { step: 6, label: 'Random Forest Ensemble', icon: '06' },
  { step: 7, label: 'Compiling Insights', icon: '07' },
];

export default function RouteLoadingModal({ currentStep, detail }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-[440px] max-w-[90vw] shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-brand px-6 py-4">
          <h3 className="text-white font-bold text-base tracking-wide">
            Generating Safe Route
          </h3>
          <p className="text-white/70 text-xs mt-0.5">
            7-stage analysis pipeline
          </p>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-1">
          {PIPELINE_STEPS.map(({ step, label, icon }) => {
            const isActive = step === currentStep;
            const isDone = step < currentStep;
            const isPending = step > currentStep;

            return (
              <div
                key={step}
                className={`flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${
                  isActive ? 'bg-brand/[0.06]' : ''
                }`}
              >
                {/* Step indicator */}
                <div
                  className={`w-7 h-7 flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                    isDone
                      ? 'bg-brand text-white'
                      : isActive
                        ? 'bg-brand/20 text-brand border-2 border-brand'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                  }`}
                >
                  {isDone ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    icon
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm font-medium transition-colors duration-300 ${
                      isDone
                        ? 'text-brand'
                        : isActive
                          ? 'text-brand font-semibold'
                          : 'text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-3 h-3 border-2 border-brand/30 border-t-brand animate-spin rounded-full" />
                      <span className="text-[11px] text-text-muted leading-tight">
                        Processing...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail bar */}
        {detail && (
          <div className="px-6 pb-4">
            <div className="bg-gray-50 border border-border px-3 py-2">
              <p className="text-[11px] text-text-muted leading-relaxed font-mono">
                {detail}
              </p>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-brand transition-all duration-500 ease-out"
            style={{ width: `${Math.round((Math.max(currentStep - 1, 0) / 7) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
