import SafetyBadge from './SafetyBadge';

export default function RouteExplanation({ routeData }) {
  if (!routeData) return null;

  const { safetyScore, distanceKm, durationMin, explanation, ensembleResult } = routeData;
  const confidence = ensembleResult?.confidence;

  return (
    <div className="space-y-5">
      <SafetyBadge score={safetyScore} />

      {/* Confidence indicator (from ensemble) */}
      {confidence != null && confidence > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted">Model confidence:</span>
          <div className="flex-1 h-1.5 bg-gray-100">
            <div
              className={`h-full ${confidence >= 0.7 ? 'bg-emerald-500' : confidence >= 0.4 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
          <span className="font-semibold text-brand">{Math.round(confidence * 100)}%</span>
        </div>
      )}

      {/* Route stats */}
      <div className="grid grid-cols-2 gap-px bg-border">
        <div className="bg-white p-3">
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Distance</div>
          <div className="text-lg font-bold text-brand mt-0.5">{distanceKm} <span className="text-xs font-medium text-text-secondary">km</span></div>
        </div>
        <div className="bg-white p-3">
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Est. Time</div>
          <div className="text-lg font-bold text-brand mt-0.5">{durationMin} <span className="text-xs font-medium text-text-secondary">min</span></div>
        </div>
      </div>

      {/* Highlights */}
      <div>
        <h4 className="text-xs font-semibold text-brand mb-3 uppercase tracking-wider">Route Comfort Highlights</h4>
        <div className="space-y-2">
          {explanation && explanation.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm text-text-secondary leading-snug">
              <div className="w-4 h-4 bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-2.5 h-2.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border border-border bg-brand/[0.02] p-3 text-[11px] text-text-secondary leading-relaxed">
        SafeRun suggests routes based on publicly available data analysed using Kernel Density Estimation
        and ensemble scoring models. This is a risk-reduction tool and does not guarantee safety. Always
        use your own judgement and be aware of your surroundings.
      </div>
    </div>
  );
}
