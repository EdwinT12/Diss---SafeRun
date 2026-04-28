import { useState } from 'react';
import { CRIME_WEIGHTS } from '../../services/safetyScoring';

export default function RouteInsights({ insights, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!insights) return null;

  const {
    crimeBreakdown,
    routeAnalysis,
    dataMonth,
    fetchedMonths,
    totalCrimesInArea,
    gridCellsAnalysed,
    safetyPriority,
    weights,
    routeType,
    environmentalDataPoints,
    spatialStats,
    kdeStats,
    hotspots,
    safetyAlpha,
    algorithm,
    graphStats,
    segmentAnalysis,
    ensembleResult,
    treeDescriptions,
    violentRatio,
    temporalTrend,
    profile: profileData,
    priorityExplanation,
    performance,
  } = insights;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'crime', label: 'Crime Data' },
    { id: 'algorithm', label: 'Algorithm' },
    { id: 'segments', label: 'Segments' },
    { id: 'ensemble', label: 'Model' },
    { id: 'performance', label: 'Performance' },
  ];

  return (
    <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-brand/60" onClick={onClose} />

      <div className="relative bg-white w-full md:max-w-lg max-h-[85vh] overflow-y-auto md:mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-brand text-white p-5 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-accent font-semibold mb-1">Route Analysis</p>
              <h2 className="text-lg font-bold">Why this route?</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 border-none text-white transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex gap-0 mt-4 border-b border-white/10 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors duration-200 bg-transparent whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-accent text-white'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {activeTab === 'overview' && (
            <OverviewTab
              routeAnalysis={routeAnalysis}
              totalCrimesInArea={totalCrimesInArea}
              dataMonth={dataMonth}
              fetchedMonths={fetchedMonths}
              gridCellsAnalysed={gridCellsAnalysed}
              environmentalDataPoints={environmentalDataPoints}
              spatialStats={spatialStats}
              kdeStats={kdeStats}
              hotspots={hotspots}
              algorithm={algorithm}
              routeType={routeType}
              temporalTrend={temporalTrend}
              violentRatio={violentRatio}
            />
          )}
          {activeTab === 'crime' && (
            <CrimeTab
              crimeBreakdown={crimeBreakdown}
              dataMonth={dataMonth}
              spatialStats={spatialStats}
              hotspots={hotspots}
            />
          )}
          {activeTab === 'algorithm' && (
            <AlgorithmTab
              safetyPriority={safetyPriority}
              weights={weights}
              gridCellsAnalysed={gridCellsAnalysed}
              routeAnalysis={routeAnalysis}
              kdeStats={kdeStats}
              graphStats={graphStats}
              safetyAlpha={safetyAlpha}
              algorithm={algorithm}
              profileData={profileData}
              priorityExplanation={priorityExplanation}
            />
          )}
          {activeTab === 'segments' && (
            <SegmentsTab segmentAnalysis={segmentAnalysis} />
          )}
          {activeTab === 'ensemble' && (
            <EnsembleTab
              ensembleResult={ensembleResult}
              treeDescriptions={treeDescriptions}
            />
          )}
          {activeTab === 'performance' && (
            <PerformanceTab
              performance={performance}
              algorithm={algorithm}
              graphStats={graphStats}
              kdeStats={kdeStats}
              totalCrimesInArea={totalCrimesInArea}
            />
          )}
        </div>

        {/* Footer disclaimer */}
        <div className="border-t border-border p-4 text-[11px] text-text-muted leading-relaxed">
          Data sourced from the UK Police API (data.police.uk) and London Datastore. Crime data is
          typically 2-3 months behind real-time. Route comfort scores are derived from multiple data
          sources using ensemble machine learning techniques and should be used for informational
          purposes only. This analysis does not guarantee safety.
        </div>
      </div>
    </div>
  );
}


function OverviewTab({
  routeAnalysis, totalCrimesInArea, dataMonth, fetchedMonths,
  gridCellsAnalysed, environmentalDataPoints, spatialStats,
  kdeStats, hotspots, algorithm, routeType, temporalTrend, violentRatio,
}) {
  const monthLabel = formatMonth(dataMonth);
  const monthCount = fetchedMonths?.length || 1;

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary leading-relaxed">
        This route was selected by analysing <strong className="text-brand">{totalCrimesInArea}</strong> crime
        records across <strong className="text-brand">{monthCount} months</strong> of data using Kernel Density
        Estimation (KDE), an ensemble of {5} decision trees, and{' '}
        {algorithm === 'graph-dijkstra'
          ? 'graph-based Dijkstra/A* routing on the OpenStreetMap road network'
          : 'OSRM pedestrian routing optimisation'}.
      </p>

      {/* Key stats grid */}
      <div className="grid grid-cols-2 gap-px bg-border border border-border">
        <Stat label="Crimes analysed" value={totalCrimesInArea} />
        <Stat label="Data period" value={`${monthCount} months`} />
        <Stat label="KDE grid cells" value={kdeStats?.gridCells || gridCellsAnalysed} />
        <Stat label="KDE bandwidth" value={kdeStats?.bandwidth ? `${(kdeStats.bandwidth * 111000).toFixed(0)}m` : 'N/A'} />
        <Stat label="Hotspots detected" value={hotspots?.length || 0} />
        <Stat label="Route type" value={routeType === 'circular' ? 'Loop' : 'A to B'} />
      </div>

      {/* Spatial statistics */}
      {spatialStats && spatialStats.meanCentre && (
        <div>
          <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-3">Spatial Analysis</h4>
          <div className="border border-border divide-y divide-border">
            <InfoRow label="Crime clustering" value={spatialStats.clusteringInterpretation || 'N/A'} />
            <InfoRow label="Nearest Neighbour Index" value={spatialStats.nearestNeighbourIndex || 'N/A'} />
            <InfoRow label="Spatial spread" value={`${(spatialStats.standardDistanceKm || 0).toFixed(2)} km`} />
            <InfoRow label="Violent crime ratio" value={`${violentRatio || 0}%`} />
            <InfoRow
              label="Temporal trend"
              value={temporalTrend === 'increasing' ? 'Increasing' : temporalTrend === 'decreasing' ? 'Decreasing' : 'Stable'}
              accent={temporalTrend === 'decreasing' ? 'green' : temporalTrend === 'increasing' ? 'amber' : null}
            />
          </div>
        </div>
      )}

      {/* Route decision summary */}
      <div>
        <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-3">Route Selection</h4>
        <div className="space-y-2.5">
          <InsightRow
            icon="shield"
            text={`${routeAnalysis.safePercentage}% of this route passes through areas with above-average comfort scores`}
          />
          <InsightRow
            icon="avoid"
            text={`${routeAnalysis.highRiskAvoided} elevated-activity grid cells were identified and avoided`}
          />
          <InsightRow
            icon="check"
            text={`${routeAnalysis.lowRiskUsed} low-activity cells were actively incorporated into the route`}
          />
          {hotspots && hotspots.length > 0 && (
            <InsightRow
              icon="grid"
              text={`${hotspots.length} area cluster(s) of higher reported incidents were detected and factored into routing`}
            />
          )}
        </div>
      </div>
    </div>
  );
}


function CrimeTab({ crimeBreakdown, dataMonth, spatialStats, hotspots }) {
  const { categories, total } = crimeBreakdown;
  const monthLabel = formatMonth(dataMonth);
  const maxImpact = categories.length > 0 ? categories[0].impact : 1;

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary">
        <span className="font-semibold text-brand">{total}</span> crime records from{' '}
        <span className="font-semibold text-brand">{monthLabel}</span> were analysed in the area
        surrounding your start point. Categories are weighted by severity using the Home Office
        Crime Severity Index.
      </p>

      {/* Crime breakdown table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-brand uppercase tracking-wider">Crime Breakdown</h4>
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Weighted Impact</span>
        </div>

        <div className="border border-border divide-y divide-border">
          {categories.map((cat) => (
            <div key={cat.category} className="px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-brand font-medium">{cat.label}</span>
                  <span className="text-[10px] text-text-muted">
                    x{cat.weight} weight
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-brand">{cat.count}</span>
                  <span className="text-[10px] text-text-muted ml-1">({cat.percentage}%)</span>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 w-full">
                <div
                  className="h-full bg-brand transition-all duration-500"
                  style={{ width: `${Math.max(2, (cat.impact / maxImpact) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hotspot summary */}
      {hotspots && hotspots.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-3">Detected Area Clusters</h4>
          <div className="border border-border divide-y divide-border">
            {hotspots.slice(0, 5).map((hs, i) => (
              <div key={i} className="px-3 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-sm text-brand font-medium">Cluster {i + 1}</span>
                  <span className="text-[10px] text-text-muted ml-2">
                    {hs.cellCount} cells, ~{hs.radiusKm} km radius
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-brand">
                    Peak: {Math.round(hs.peakDensity * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weight explanation */}
      <div className="bg-brand/[0.03] border border-border p-4">
        <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-2">How weights work</h4>
        <p className="text-xs text-text-secondary leading-relaxed">
          Each crime category is assigned a severity weight (0.3 to 3.0) based on the Home Office Crime Severity
          Index and relevance to pedestrian safety. Violent crimes and robbery are weighted highest (3.0, 2.5)
          because they pose the greatest risk to runners. Property crimes like shoplifting (0.3) have minimal
          impact on route scoring. Temporal decay weighting (lambda = 0.15) ensures more recent incidents have
          greater influence on the analysis.
        </p>
      </div>
    </div>
  );
}


function AlgorithmTab({ safetyPriority, weights, gridCellsAnalysed, routeAnalysis, kdeStats, graphStats, safetyAlpha, algorithm, profileData, priorityExplanation }) {
  const priorityLabels = {
    maximum_safety: 'Maximum Safety',
    balanced: 'Balanced',
    efficiency_focused: 'Distance Focused',
  };

  const pd = profileData || {};

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary leading-relaxed">
        The route generation algorithm uses a multi-step pipeline combining Kernel Density Estimation (KDE),
        {algorithm === 'graph-dijkstra'
          ? ' OpenStreetMap graph construction, and modified Dijkstra/A* pathfinding with per-edge safety weighting.'
          : ' grid-based safety scoring, and OSRM pedestrian routing optimisation.'}
      </p>

      {/* Priority profile impact */}
      {priorityExplanation && priorityExplanation.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-3">
            "{priorityLabels[safetyPriority]}" Mode Impact
          </h4>
          <div className="border border-border p-4 space-y-2">
            {priorityExplanation.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed">
                <span className="text-accent font-bold shrink-0 mt-px">-</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile parameters */}
      {pd.safetyAlpha && (
        <div>
          <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-3">Profile Parameters</h4>
          <div className="border border-border divide-y divide-border">
            <InfoRow label="Data depth" value={`${pd.monthsToFetch} months`} />
            <InfoRow label="Safety alpha" value={pd.safetyAlpha} />
            <InfoRow label="Cost exponent" value={pd.costExponent} />
            <InfoRow label="Hotspot buffer" value={`${pd.hotspotBufferKm * 1000}m`} />
            <InfoRow label="Temporal decay lambda" value={pd.temporalDecayLambda} />
            <InfoRow label="KDE bandwidth scale" value={`${pd.kdeBandwidthScale}x`} />
            <InfoRow label="Distance tolerance" value={`${Math.round(pd.distanceTolerance.min * 100)}% - ${Math.round(pd.distanceTolerance.max * 100)}%`} />
          </div>
        </div>
      )}

      {/* Pipeline steps */}
      <div>
        <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-3">Processing Pipeline</h4>
        <div className="border border-border divide-y divide-border">
          <PipelineStep
            number="1"
            title="Multi-month Data Collection"
            desc={`UK Police API crime data fetched across ${pd.monthsToFetch || 6} months with Supabase caching. Temporal decay weighting applied (lambda = ${pd.temporalDecayLambda || 0.15}).`}
          />
          <PipelineStep
            number="2"
            title="Kernel Density Estimation"
            desc={`Gaussian KDE computed over ${kdeStats?.gridCells || gridCellsAnalysed} grid cells at ${kdeStats?.resolution ? (kdeStats.resolution * 111000).toFixed(0) : '~111'}m resolution. Bandwidth: ${kdeStats?.bandwidth ? (kdeStats.bandwidth * 111000).toFixed(0) : 'auto'}m (Silverman's rule). Scale: ${pd.kdeBandwidthScale || 1.0}x.`}
          />
          <PipelineStep
            number="3"
            title="Hotspot Detection"
            desc={`Connected-component analysis on KDE surface identifies contiguous high-density clusters. Buffer zone: ${pd.hotspotBufferKm ? pd.hotspotBufferKm * 1000 : 150}m around each centroid.`}
          />
          <PipelineStep
            number="4"
            title="Ensemble Scoring"
            desc="5 decision trees with profile-specific weight redistribution evaluate crime density, road type, lighting, hotspot proximity, violent crime ratio, and temporal trends."
          />
          {algorithm === 'graph-dijkstra' ? (
            <>
              <PipelineStep
                number="5"
                title="Graph Construction"
                desc={`OSM road network fetched via Overpass API. ${graphStats?.totalNodes || 'N/A'} nodes, ${graphStats?.totalEdges || 'N/A'} edges. Per-edge cost: dist * (1 + ${safetyAlpha} * density^${pd.costExponent || 2}) * roadMult / comfort.`}
              />
              <PipelineStep
                number="6"
                title="Dijkstra/A* Pathfinding"
                desc="Modified Dijkstra's algorithm (with A* heuristic for point-to-point) finds the path minimising the composite safety-weighted cost. Binary min-heap priority queue for O((V+E) log V) performance."
              />
            </>
          ) : (
            <>
              <PipelineStep
                number="5"
                title="Waypoint Generation"
                desc="Candidate waypoints generated in 8 compass directions, each scored against the KDE safety surface."
              />
              <PipelineStep
                number="6"
                title="OSRM Routing + Scoring"
                desc="OSRM pedestrian router queried with safest waypoints. Candidate routes scored point-by-point against KDE grid."
              />
            </>
          )}
        </div>
      </div>

      {/* Weights configuration */}
      <div>
        <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-3">Scoring Weights</h4>
        <div className="border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Priority mode</span>
            <span className="text-sm font-semibold text-brand">{priorityLabels[safetyPriority] || safetyPriority}</span>
          </div>
          <div className="space-y-2">
            <WeightBar label="Crime data" value={weights.crime} />
            <WeightBar label="Environmental" value={weights.env} />
          </div>
        </div>
      </div>

      {/* Cost function */}
      <div className="bg-brand/[0.03] border border-border p-4">
        <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-2">Edge Cost Function</h4>
        <code className="text-xs text-brand block font-mono leading-relaxed">
          cost(e) = dist * (1 + {safetyAlpha} * density<sup>2</sup>) * pref / comfort
        </code>
        <p className="text-xs text-text-secondary mt-2 leading-relaxed">
          Where <em>density</em> is the KDE crime density (0-1) at the edge midpoint,{' '}
          <em>comfort</em> is derived from road type, lighting, and surface quality (0-1),{' '}
          and <em>pref</em> reflects user preference multipliers (lit areas, narrow paths, parks).
          The quadratic density term creates non-linear avoidance of high-crime edges (Levy et al. 2018).
        </p>
      </div>
    </div>
  );
}


function SegmentsTab({ segmentAnalysis }) {
  if (!segmentAnalysis || segmentAnalysis.length === 0) {
    return (
      <div className="text-sm text-text-muted py-8 text-center">
        Segment analysis is available when using graph-based routing.
        Try generating a new route - the system will attempt graph routing first.
      </div>
    );
  }

  const maxDist = Math.max(...segmentAnalysis.map((s) => s.distanceM));

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary leading-relaxed">
        Per-segment analysis showing the safety profile of each street section on your route.
        Segments are grouped by street name.
      </p>

      <div className="border border-border divide-y divide-border">
        {segmentAnalysis.map((seg, i) => (
          <div key={i} className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-brand truncate">{seg.name}</span>
                {seg.isLit && (
                  <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 font-semibold uppercase tracking-wider shrink-0">
                    Lit
                  </span>
                )}
              </div>
              <span className="text-xs text-text-muted shrink-0 ml-2">{seg.distanceM}m</span>
            </div>

            <div className="flex items-center gap-3 mt-1.5">
              {/* Safety bar */}
              <div className="flex-1 h-2 bg-gray-100">
                <div
                  className={`h-full transition-all duration-500 ${
                    seg.safetyScore >= 70 ? 'bg-emerald-500' :
                    seg.safetyScore >= 50 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${seg.safetyScore}%` }}
                />
              </div>
              <span className={`text-xs font-semibold w-8 text-right ${
                seg.safetyScore >= 70 ? 'text-emerald-600' :
                seg.safetyScore >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {seg.safetyScore}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1 text-[10px] text-text-muted">
              <span>{seg.highwayType}</span>
              <span>Comfort: {Math.round(seg.comfort * 100)}%</span>
              <span>Density: {(seg.avgDensity * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function EnsembleTab({ ensembleResult, treeDescriptions }) {
  if (!ensembleResult || !ensembleResult.edgeScores || ensembleResult.edgeScores.length === 0) {
    return (
      <div className="text-sm text-text-muted py-8 text-center">
        Ensemble scoring data is available when using graph-based routing.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary leading-relaxed">
        A Random Forest-inspired ensemble of <strong className="text-brand">{ensembleResult.treesUsed} decision trees</strong> evaluates
        multiple safety features independently, then aggregates their predictions through weighted voting.
      </p>

      {/* Ensemble summary */}
      <div className="grid grid-cols-2 gap-px bg-border border border-border">
        <Stat label="Ensemble score" value={ensembleResult.overallScore} />
        <Stat label="Confidence" value={`${Math.round(ensembleResult.confidence * 100)}%`} />
      </div>

      {/* Decision trees */}
      {treeDescriptions && treeDescriptions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-3">Decision Trees</h4>
          <div className="border border-border divide-y divide-border">
            {treeDescriptions.map((tree, i) => (
              <div key={i} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-brand">{formatTreeName(tree.name)}</span>
                  <span className="text-[10px] text-text-muted">Weight: {Math.round(tree.weight * 100)}%</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{tree.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature importance */}
      {ensembleResult.featureImportance && (
        <div>
          <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-3">Feature Importance</h4>
          <div className="border border-border p-4 space-y-2.5">
            {Object.entries(ensembleResult.featureImportance)
              .sort(([, a], [, b]) => b - a)
              .map(([feature, importance]) => (
                <div key={feature} className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary w-32 shrink-0">{formatFeatureName(feature)}</span>
                  <div className="flex-1 h-2 bg-gray-100">
                    <div className="h-full bg-brand" style={{ width: `${importance * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-brand w-10 text-right">{Math.round(importance * 100)}%</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Methodology */}
      <div className="bg-brand/[0.03] border border-border p-4">
        <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-2">Methodology</h4>
        <p className="text-xs text-text-secondary leading-relaxed">
          Each decision tree in the ensemble evaluates a different subset of safety features using
          threshold-based rules derived from criminology literature (Rosser et al. 2016, Khanfor et al. 2021,
          Lozano Dominguez & Mateo Sanguino 2021). The ensemble prediction is the weighted average of all tree
          outputs, with confidence measured as the agreement (inverse variance) between trees. Higher confidence
          indicates consistent safety signals across all evaluation criteria.
        </p>
      </div>
    </div>
  );
}


function PerformanceTab({ performance, algorithm, graphStats, kdeStats, totalCrimesInArea }) {
  if (!performance || performance.total_ms == null) {
    return (
      <div className="text-sm text-text-muted py-8 text-center">
        Performance data is recorded automatically when a route is generated.
        Generate a route to populate this panel.
      </div>
    );
  }

  const stages = [
    { id: 'step1_ms', label: 'Stage 1: Crime data fetch', desc: 'UK Police API + Supabase cache' },
    { id: 'step2_ms', label: 'Stage 2: Kernel Density Estimation', desc: 'Gaussian KDE, Silverman bandwidth' },
    { id: 'step3_ms', label: 'Stage 3: Spatial statistics', desc: 'NNI (Clark & Evans), spread, hotspots' },
    { id: 'step4_ms', label: 'Stage 4: Environmental data', desc: 'SafeStats query from Supabase' },
    { id: 'step5_ms', label: 'Stage 5: Graph build + search', desc: 'Overpass + Dijkstra/A*' },
    { id: 'step6_ms', label: 'Stage 6: Ensemble scoring', desc: '5-tree Random Forest-style scoring' },
    { id: 'step7_ms', label: 'Stage 7: Compile insights', desc: 'Crime breakdown, segment analysis' },
  ];

  const total = performance.total_ms || 1;
  const maxStage = Math.max(...stages.map((s) => performance[s.id] || 0));

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary leading-relaxed">
        End-to-end pipeline timing on the current device, captured from the
        seven-stage route generator. These numbers are real measurements
        from this generation, not estimates.
      </p>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-px bg-border border border-border">
        <Stat label="Total time" value={`${(performance.total_ms / 1000).toFixed(2)} s`} />
        <Stat label="Slowest stage" value={`${maxStage} ms`} />
        <Stat label="Crimes processed" value={totalCrimesInArea ?? '-'} />
        <Stat label="KDE cells" value={kdeStats?.gridCells ?? '-'} />
        {graphStats && (
          <>
            <Stat label="Graph nodes" value={graphStats.totalNodes ?? '-'} />
            <Stat label="Graph edges" value={graphStats.totalEdges ?? '-'} />
          </>
        )}
      </div>

      {/* Stage timings */}
      <div>
        <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-3">Stage Breakdown</h4>
        <div className="border border-border divide-y divide-border">
          {stages.map((s) => {
            const ms = performance[s.id] || 0;
            const pct = total > 0 ? Math.round((ms / total) * 100) : 0;
            const barPct = maxStage > 0 ? Math.max(2, Math.round((ms / maxStage) * 100)) : 0;
            return (
              <div key={s.id} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-brand">{s.label}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-brand">{ms} ms</span>
                    <span className="text-[10px] text-text-muted ml-1.5">({pct}%)</span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 mb-1.5">
                  <div className="h-full bg-brand transition-all duration-500" style={{ width: `${barPct}%` }} />
                </div>
                <p className="text-[11px] text-text-muted leading-tight">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Algorithm context */}
      <div className="bg-brand/[0.03] border border-border p-4">
        <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-2">Run Context</h4>
        <p className="text-xs text-text-secondary leading-relaxed">
          Routing algorithm: <strong className="text-brand">
            {algorithm === 'graph-dijkstra' ? 'Graph-based Dijkstra/A*' : 'OSRM pedestrian fallback'}
          </strong>.
          {' '}Timing measured with <code className="text-brand">performance.now()</code> at each stage boundary.
          External API latency (UK Police, Overpass, OSRM) is included where the stage makes a network
          request. The total reflects what the user actually waits for, including the small <code>setTimeout(0)</code>
          yields used to redraw the progress modal.
        </p>
      </div>
    </div>
  );
}


function Stat({ label, value }) {
  return (
    <div className="bg-white p-3">
      <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">{label}</div>
      <div className="text-lg font-bold text-brand mt-0.5">{value}</div>
    </div>
  );
}

function InfoRow({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className={`text-sm font-semibold ${
        accent === 'green' ? 'text-emerald-600' :
        accent === 'amber' ? 'text-amber-600' :
        'text-brand'
      }`}>
        {value}
      </span>
    </div>
  );
}

function InsightRow({ icon, text }) {
  const icons = {
    shield: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    avoid: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    check: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    grid: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  };

  return (
    <div className="flex items-start gap-2.5">
      <div className="w-5 h-5 bg-accent/10 flex items-center justify-center shrink-0 text-accent">
        {icons[icon]}
      </div>
      <span className="text-sm text-text-secondary leading-snug">{text}</span>
    </div>
  );
}

function PipelineStep({ number, title, desc }) {
  return (
    <div className="flex gap-3 p-3">
      <div className="w-6 h-6 bg-brand flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-white">{number}</span>
      </div>
      <div>
        <div className="text-sm font-semibold text-brand">{title}</div>
        <div className="text-xs text-text-secondary mt-0.5 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

function WeightBar({ label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-secondary w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100">
        <div className="h-full bg-brand" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-xs font-semibold text-brand w-8 text-right">{Math.round(value * 100)}%</span>
    </div>
  );
}

function formatMonth(dateStr) {
  if (!dateStr) return 'N/A';
  const [year, month] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

function formatTreeName(name) {
  return name
    .replace('Tree', '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

function formatFeatureName(name) {
  const names = {
    crimeDensity: 'Crime density',
    roadComfort: 'Road comfort',
    isLit: 'Street lighting',
    hotspotDistance: 'Hotspot proximity',
    violentRatio: 'Violent crime ratio',
  };
  return names[name] || name;
}
