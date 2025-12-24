/**
 * CleanPlate Score Calculator
 * 
 * Algorithm v2.0:
 * Score = (Result × 0.35) + (Violations × 0.25) + (Trend × 0.15) + (TrackRecord × 0.15) + (Recency × 0.10)
 * 
 * Key features:
 * - Risk-adjusted time decay (half-life varies by risk level)
 * - Risk-adjusted recency scoring
 * - Track record penalty for historical problems
 */

interface InspectionResult {
  results: string
  inspection_date: string
  violation_count: number
  critical_count: number
  risk_level: number
}

interface ScoreComponents {
  result: number
  violations: number
  trend: number
  trackRecord: number
  recency: number
}

/**
 * Get risk-adjusted half-life in months for time decay
 * Risk 1 (High): inspected every 6 months → 6 month half-life
 * Risk 2 (Medium): inspected every 12 months → 12 month half-life
 * Risk 3 (Low): inspected every 24 months → 24 month half-life
 */
export function getRiskAdjustedHalfLife(riskLevel: number): number {
  switch (riskLevel) {
    case 1: return 6
    case 2: return 12
    case 3: return 24
    default: return 12 // Default to medium
  }
}

/**
 * Get expected inspection interval in days for a risk level
 */
export function getExpectedIntervalDays(riskLevel: number): number {
  switch (riskLevel) {
    case 1: return 180  // 6 months
    case 2: return 365  // 12 months
    case 3: return 730  // 24 months
    default: return 365 // Default to medium
  }
}

/**
 * Calculate time decay weight for an inspection based on age and risk level
 * Uses exponential decay with risk-adjusted half-life
 */
export function calculateTimeWeight(monthsSinceInspection: number, riskLevel: number): number {
  const halfLife = getRiskAdjustedHalfLife(riskLevel)
  const lambda = 0.693 / halfLife
  return Math.exp(-lambda * monthsSinceInspection)
}

/**
 * Calculate risk-adjusted recency score
 * Measures if the latest inspection is on schedule for this risk level
 */
export function calculateRecencyScore(daysSinceInspection: number, riskLevel: number): number {
  const expectedInterval = getExpectedIntervalDays(riskLevel)
  const ratio = daysSinceInspection / expectedInterval
  
  if (ratio < 0.5) return 100  // Very recent (well ahead of schedule)
  if (ratio <= 1.0) return 85  // On schedule
  if (ratio <= 1.25) return 60 // Slightly overdue
  return 40                     // Overdue
}

/**
 * Get outcome points for an inspection result
 */
function getOutcomePoints(results: string): number {
  const resultLower = results.toLowerCase()
  if (resultLower.includes('pass') && !resultLower.includes('condition') && !resultLower.includes('fail')) {
    return 100
  } else if (resultLower.includes('condition')) {
    return 70
  } else if (resultLower.includes('fail')) {
    return 30
  }
  return 50 // Unknown/other
}

/**
 * Calculate months since a given date
 */
function getMonthsSinceDate(dateStr: string): number {
  const date = new Date(dateStr)
  const now = new Date()
  const months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth())
  const dayDiff = now.getDate() - date.getDate()
  return months + (dayDiff / 30) // Fractional months
}

/**
 * Calculate days since a given date
 */
function getDaysSinceInspection(dateStr: string): number {
  const inspectionDate = new Date(dateStr)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - inspectionDate.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Calculate the Result component (35%)
 * Time-weighted average of inspection outcomes using risk-adjusted decay
 */
function calculateResultScore(inspections: InspectionResult[], riskLevel: number): number {
  if (inspections.length === 0) return 50

  let weightedSum = 0
  let totalWeight = 0

  for (const insp of inspections) {
    const monthsSince = getMonthsSinceDate(insp.inspection_date)
    const weight = calculateTimeWeight(monthsSince, riskLevel)
    const points = getOutcomePoints(insp.results)
    
    weightedSum += points * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 50
}

/**
 * Calculate the Violations component (25%)
 * Based on critical and non-critical violation counts from latest inspection
 */
function calculateViolationsScore(latest: InspectionResult): number {
  const criticalPenalty = latest.critical_count * 15
  const nonCriticalPenalty = (latest.violation_count - latest.critical_count) * 5
  return Math.max(0, 100 - criticalPenalty - nonCriticalPenalty)
}

/**
 * Calculate the Trend component (15%)
 * Compares recent 2 inspections vs previous 2
 */
function calculateTrendScore(inspections: InspectionResult[]): number {
  if (inspections.length < 3) return 60 // Default to neutral (stable)

  // Get scores for inspections
  const scores = inspections.slice(0, 4).map(insp => getOutcomePoints(insp.results))
  
  if (scores.length < 3) return 60

  // Compare last 2 vs previous 2 (or 1 if only 3 inspections)
  const recentAvg = (scores[0] + scores[1]) / 2
  const previousAvg = scores.length >= 4 
    ? (scores[2] + scores[3]) / 2 
    : scores[2]
  
  const trendDelta = recentAvg - previousAvg

  // Map trend delta to score
  if (trendDelta >= 30) return 100       // Strong improvement
  if (trendDelta >= 15) return 85        // Moderate improvement
  if (trendDelta >= 1) return 70         // Slight improvement
  if (trendDelta >= -1) return 60        // Stable (within ±1)
  if (trendDelta >= -14) return 45       // Slight decline
  if (trendDelta >= -29) return 30       // Moderate decline
  return 15                               // Strong decline
}

/**
 * Calculate the Track Record component (15%)
 * Penalizes historical problems: failures, critical violations, closures
 */
function calculateTrackRecordScore(inspections: InspectionResult[]): number {
  let penaltyPoints = 0
  const now = new Date()

  for (const insp of inspections) {
    const inspDate = new Date(insp.inspection_date)
    const monthsAgo = (now.getFullYear() - inspDate.getFullYear()) * 12 + 
                      (now.getMonth() - inspDate.getMonth())
    
    const resultLower = insp.results.toLowerCase()

    // Fail result: +2 penalty, 36 month lookback
    if (resultLower.includes('fail') && monthsAgo <= 36) {
      penaltyPoints += 2
    }

    // Critical violations: +3 penalty per inspection with criticals, 36 month lookback
    if (insp.critical_count > 0 && monthsAgo <= 36) {
      penaltyPoints += 3
    }

    // Note: Closure/suspension detection would require additional data field
    // Re-inspection detection would require inspection_type field
  }

  // Cap penalty at 20 points
  const cappedPenalty = Math.min(penaltyPoints, 20)
  
  // Convert to score (0-100)
  return Math.max(0, 100 - (cappedPenalty * 5))
}

/**
 * Calculate pass streak (for bonus modifier)
 */
function getPassStreak(inspections: InspectionResult[]): number {
  let streak = 0
  for (const insp of inspections) {
    const resultLower = insp.results.toLowerCase()
    if (resultLower.includes('pass') && !resultLower.includes('condition') && !resultLower.includes('fail')) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/**
 * Calculate all score components
 */
function calculateComponents(
  latestInspection: InspectionResult,
  allInspections: InspectionResult[]
): ScoreComponents {
  const riskLevel = latestInspection.risk_level || 2
  const daysSince = getDaysSinceInspection(latestInspection.inspection_date)

  return {
    result: calculateResultScore(allInspections, riskLevel),
    violations: calculateViolationsScore(latestInspection),
    trend: calculateTrendScore(allInspections),
    trackRecord: calculateTrackRecordScore(allInspections),
    recency: calculateRecencyScore(daysSince, riskLevel)
  }
}

/**
 * Calculate CleanPlate Score
 * 
 * Formula: Score = (Result × 0.35) + (Violations × 0.25) + (Trend × 0.15) + (TrackRecord × 0.15) + (Recency × 0.10)
 */
export function calculateCleanPlateScore(
  latestInspection: InspectionResult,
  recentInspections: InspectionResult[]
): number {
  const components = calculateComponents(latestInspection, recentInspections)
  
  // Apply weights: 35/25/15/15/10
  let score = 
    components.result * 0.35 +
    components.violations * 0.25 +
    components.trend * 0.15 +
    components.trackRecord * 0.15 +
    components.recency * 0.10

  // Apply modifiers
  const passStreak = getPassStreak(recentInspections)
  if (passStreak >= 3) {
    score += 5 // Bonus for 3+ consecutive passes
  }

  // Penalty for recent failure (within 90 days)
  const hasRecentFailure = recentInspections.some(
    (insp) => 
      insp.results.toLowerCase().includes('fail') &&
      getDaysSinceInspection(insp.inspection_date) <= 90
  )
  if (hasRecentFailure) {
    score -= 10
  }

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Get score components for display/debugging
 */
export function getScoreBreakdown(
  latestInspection: InspectionResult,
  recentInspections: InspectionResult[]
): ScoreComponents & { finalScore: number } {
  const components = calculateComponents(latestInspection, recentInspections)
  const finalScore = calculateCleanPlateScore(latestInspection, recentInspections)
  
  return {
    ...components,
    finalScore
  }
}

/**
 * Get score label based on score value
 */
export function getScoreLabel(score: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
  if (score >= 90) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Poor'
}

/**
 * Get score color based on score value
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return '#16a34a' // Green
  if (score >= 70) return '#65a30d' // Light Green
  if (score >= 50) return '#d97706' // Amber
  return '#dc2626' // Red
}
