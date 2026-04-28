import { getSafetyLabel } from '../../services/safetyScoring';

export default function SafetyBadge({ score }) {
  const label = getSafetyLabel(score);
  const displayScore = Math.round(score);

  return (
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-brand flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-bold text-white leading-none">{displayScore}</div>
          <div className="text-[8px] text-white/60 uppercase tracking-wider font-medium mt-0.5">score</div>
        </div>
      </div>
      <div>
        <div className="text-base font-bold text-brand">{label}</div>
        <div className="text-xs text-text-secondary">Route Comfort Score</div>
      </div>
    </div>
  );
}
