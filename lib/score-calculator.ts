interface InspectionResult {
  results: string
  inspection_date: string
  violation_count: number
  critical_count: number
  risk_level: number
}

interface ScoreComponents {
  result: number
  trend: number
  violations: number
  recency: number
  risk: number
}

/**
 * Calculate CleanPlate Score based on PRD formula:
 * Score = (Result × 0.40) + (Trend × 0.20) + (Violations × 0.20) + (Recency × 0.10) + (Risk × 0.10)
 */
export function calculateCleanPlateScore(
  latestInspection: InspectionResult,
  recentInspections: InspectionResult[]
): number {
  const components = calculateComponents(latestInspection, recentInspections)
  
  let score = 
    components.result * 0.40 +
    components.trend * 0.20 +
    components.violations * 0.20 +
    components.recency * 0.10 +
    components.risk * 0.10

  // Apply modifiers
  const passStreak = getPassStreak(recentInspections)
  if (passStreak >= 3) {
    score += 5
  }

  const daysSinceInspection = getDaysSinceInspection(latestInspection.inspection_date)
  if (daysSinceInspection > 540) { // >18 months
    score -= 20
  }

  const hasRecentFailure = recentInspections.some(
    (insp) => 
      insp.results.toLowerCase().includes('fail') &&
      getDaysSinceInspection(insp.inspection_date) <= 90
  )
  if (hasRecentFailure) {
    score -= 10
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

function calculateComponents(
  latest: InspectionResult,
  recent: InspectionResult[]
): ScoreComponents {
  // Result component (40%)
  let result = 0
  const resultLower = latest.results.toLowerCase()
  if (resultLower.includes('pass') && !resultLower.includes('condition')) {
    result = 100
  } else if (resultLower.includes('condition')) {
    result = 70
  } else if (resultLower.includes('fail')) {
    result = 30
  }

  // Trend component (20%)
  const trend = calculateTrend(recent)

  // Violations component (20%)
  const violations = Math.max(
    0,
    100 - (latest.critical_count * 15) - ((latest.violation_count - latest.critical_count) * 5)
  )

  // Recency component (10%)
  const daysSince = getDaysSinceInspection(latest.inspection_date)
  let recency = 0
  if (daysSince < 180) {
    recency = 100
  } else if (daysSince < 365) {
    recency = 80
  } else if (daysSince < 540) {
    recency = 50
  } else {
    recency = 20
  }

  // Risk component (10%)
  let risk = 0
  if (latest.risk_level === 3) {
    risk = 100
  } else if (latest.risk_level === 2) {
    risk = 80
  } else if (latest.risk_level === 1) {
    risk = 60
  }

  return { result, trend, violations, recency, risk }
}

function calculateTrend(inspections: InspectionResult[]): number {
  if (inspections.length < 3) return 0

  const last3 = inspections.slice(0, 3)
  const scores = last3.map((insp) => {
    const resultLower = insp.results.toLowerCase()
    if (resultLower.includes('pass') && !resultLower.includes('condition')) return 100
    if (resultLower.includes('condition')) return 70
    if (resultLower.includes('fail')) return 30
    return 50
  })

  // Check if improving (ascending), declining (descending), or stable
  const first = scores[2]
  const middle = scores[1]
  const last = scores[0]

  if (last > middle && middle > first) return 10 // improving
  if (last < middle && middle < first) return -10 // declining
  return 0 // stable
}

function getPassStreak(inspections: InspectionResult[]): number {
  let streak = 0
  for (const insp of inspections) {
    const resultLower = insp.results.toLowerCase()
    if (resultLower.includes('pass') && !resultLower.includes('condition')) {
      streak++
    } else {
      break
    }
  }
  return streak
}

function getDaysSinceInspection(date: string): number {
  const inspectionDate = new Date(date)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - inspectionDate.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}



