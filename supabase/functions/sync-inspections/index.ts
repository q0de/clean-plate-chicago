import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CHICAGO_API = "https://data.cityofchicago.org/resource/4ijn-s7e5.json";
const BATCH_SIZE = 1000;

interface ChicagoInspection {
  inspection_id: string;
  dba_name: string;
  aka_name?: string;
  license_: string;
  facility_type: string;
  risk?: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: string;
  longitude?: string;
  inspection_date: string;
  inspection_type: string;
  results: string;
  violations?: string;
}

interface InspectionRecord {
  results: string;
  inspection_date: string;
  violation_count: number;
  critical_count: number;
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the date of the most recent inspection in our database
    // Only fetch new inspections since then (with 1 day buffer for safety)
    const { data: lastInspection } = await supabase
      .from("inspections")
      .select("inspection_date")
      .order("inspection_date", { ascending: false })
      .limit(1)
      .single();

    // Default to 7 days ago if no inspections exist, otherwise use last inspection date minus 1 day buffer
    const defaultLookback = new Date();
    defaultLookback.setDate(defaultLookback.getDate() - 7);
    
    let sinceDateStr: string;
    if (lastInspection?.inspection_date) {
      const lastDate = new Date(lastInspection.inspection_date);
      lastDate.setDate(lastDate.getDate() - 1); // 1 day buffer to catch any late entries
      sinceDateStr = lastDate.toISOString().split("T")[0];
    } else {
      sinceDateStr = defaultLookback.toISOString().split("T")[0];
    }

    console.log(`Syncing inspections since: ${sinceDateStr}`);

    // Create sync log entry
    const { data: logEntry, error: logError } = await supabase
      .from("sync_logs")
      .insert({
        started_at: new Date().toISOString(),
        status: "running",
        records_fetched: 0,
        records_inserted: 0,
        records_updated: 0,
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create sync log:", logError);
    }

    const logId = logEntry?.id;

    let offset = 0;
    let hasMore = true;
    let totalFetched = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    const errors: string[] = [];

    while (hasMore) {
      try {
        // Only fetch inspections since the last sync date
        const url = `${CHICAGO_API}?$limit=${BATCH_SIZE}&$offset=${offset}&$order=inspection_date DESC&$where=inspection_date >= '${sinceDateStr}'`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Chicago API error: ${response.status}`);
        }

        const data: ChicagoInspection[] = await response.json();

        if (data.length === 0) {
          hasMore = false;
          break;
        }

        totalFetched += data.length;
        console.log(`Fetched ${data.length} inspections (total: ${totalFetched})`);

        // Process each inspection
        for (const inspection of data) {
          try {
            await processInspection(inspection, supabase);
            totalInserted++;
          } catch (error) {
            const errorMsg = `Error processing ${inspection.inspection_id}: ${error.message}`;
            errors.push(errorMsg);
            console.error(errorMsg);
          }
        }

        // Update sync log progress
        if (logId) {
          await supabase
            .from("sync_logs")
            .update({
              records_fetched: totalFetched,
              records_inserted: totalInserted,
              records_updated: totalUpdated,
              errors: errors.length > 0 ? errors : null,
            })
            .eq("id", logId);
        }

        if (data.length < BATCH_SIZE) {
          hasMore = false;
        } else {
          offset += BATCH_SIZE;
        }
      } catch (error) {
        console.error(`Error fetching batch at offset ${offset}:`, error);
        errors.push(`Batch error at offset ${offset}: ${error.message}`);
        hasMore = false;
      }
    }

    // Mark sync as completed
    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          status: errors.length > 0 ? "failed" : "completed",
          records_fetched: totalFetched,
          records_inserted: totalInserted,
          records_updated: totalUpdated,
          errors: errors.length > 0 ? errors : null,
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        records_fetched: totalFetched,
        records_inserted: totalInserted,
        records_updated: totalUpdated,
        errors: errors.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function processInspection(
  inspection: ChicagoInspection,
  supabase: any
) {
  // Parse risk level
  let riskLevel: number | null = null;
  if (inspection.risk) {
    const riskMatch = inspection.risk.match(/Risk (\d+)/);
    if (riskMatch) {
      riskLevel = parseInt(riskMatch[1]);
    }
  }

  // Get or create establishment
  const { data: establishment, error: estError } = await supabase
    .from("establishments")
    .select("id")
    .eq("license_number", inspection.license_)
    .single();

  let establishmentId: string;

  if (estError && estError.code === "PGRST116") {
    // Create new establishment
    const slug = createSlug(inspection.dba_name, inspection.license_);
    const lat = inspection.latitude ? parseFloat(inspection.latitude) : null;
    const lng = inspection.longitude ? parseFloat(inspection.longitude) : null;

    const { data: newEst, error: createError } = await supabase
      .from("establishments")
      .insert({
        license_number: inspection.license_,
        dba_name: inspection.dba_name,
        aka_name: inspection.aka_name || null,
        facility_type: inspection.facility_type,
        risk_level: riskLevel,
        address: inspection.address,
        city: inspection.city || "Chicago",
        state: inspection.state || "IL",
        zip: inspection.zip || null,
        latitude: lat,
        longitude: lng,
        location: lat && lng ? `POINT(${lng} ${lat})` : null,
        slug,
        latest_result: inspection.results,
        latest_inspection_date: inspection.inspection_date.split("T")[0],
        total_inspections: 1,
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create establishment: ${createError.message}`);
    }

    establishmentId = newEst.id;
  } else if (estError) {
    throw new Error(`Failed to fetch establishment: ${estError.message}`);
  } else {
    establishmentId = establishment.id;

    // Update establishment with latest inspection info
    await supabase
      .from("establishments")
      .update({
        latest_result: inspection.results,
        latest_inspection_date: inspection.inspection_date.split("T")[0],
        total_inspections: supabase.rpc("increment", {
          table_name: "establishments",
          column_name: "total_inspections",
          id: establishmentId,
        }),
      })
      .eq("id", establishmentId);
  }

  // Parse violations
  const violations = parseViolations(inspection.violations || "");
  const criticalCount = violations.filter((v) => v.is_critical).length;

  // Normalize inspection_id to just the numeric ID from Chicago API
  // This prevents duplicates from different ID formats
  const normalizedInspectionId = String(inspection.inspection_id).split('-')[0].replace(/\D/g, '') || inspection.inspection_id;

  // Use upsert to handle duplicates atomically - this prevents race conditions
  // The unique constraint on inspection_id will prevent actual duplicates at the database level
  // This approach is safer than check-then-insert which can have race conditions
  const { data: newInspection, error: inspError } = await supabase
    .from("inspections")
    .upsert({
      establishment_id: establishmentId,
      inspection_id: normalizedInspectionId,
      inspection_date: inspection.inspection_date.split("T")[0],
      inspection_type: inspection.inspection_type,
      results: inspection.results,
      raw_violations: inspection.violations || null,
      violation_count: violations.length,
      critical_count: criticalCount,
    }, {
      onConflict: 'inspection_id',
      ignoreDuplicates: false // Update if exists (keeps data fresh)
    })
    .select()
    .maybeSingle(); // Use maybeSingle() to handle cases where no row is returned

  if (inspError) {
    // If it's a duplicate key error, that's fine - just skip
    // This shouldn't happen with upsert, but handle it just in case
    if (inspError.code === '23505' || inspError.message?.includes('duplicate') || inspError.message?.includes('unique')) {
      // Inspection already exists, skip it
      return;
    }
    throw new Error(`Failed to create/update inspection: ${inspError.message}`);
  }

  // If no inspection was returned (shouldn't happen with upsert, but handle it)
  if (!newInspection) {
    // This means the inspection already exists and wasn't updated, skip it
    return;
  }

  // Create violations (use upsert to handle duplicates)
  if (violations.length > 0) {
    const violationRecords = violations.map((v) => ({
      inspection_id: newInspection.id,
      violation_code: v.code,
      violation_description: v.description,
      violation_comment: v.comment || null,
      is_critical: v.is_critical,
    }));

    const { error: violError } = await supabase
      .from("violations")
      .upsert(violationRecords, {
        onConflict: 'inspection_id,violation_code',
        ignoreDuplicates: true  // Skip if already exists
      });

    if (violError) {
      console.error("Failed to create violations:", violError);
    }
  }

  // Recalculate CleanPlate score for establishment
  await recalculateScore(establishmentId, riskLevel || 2, supabase);
}

function parseViolations(violationsString: string): Array<{
  code: string;
  description: string;
  comment?: string;
  is_critical: boolean;
}> {
  if (!violationsString) return [];

  // Violations are pipe-delimited
  const parts = violationsString.split("|").filter((p) => p.trim());

  return parts.map((part) => {
    // Format: "Code X: Description. Comment"
    const codeMatch = part.match(/Code\s+(\d+[A-Z]?)/i);
    const code = codeMatch ? codeMatch[1] : "";

    // Extract description (everything after "Code X:")
    const descMatch = part.match(/Code\s+\d+[A-Z]?:\s*(.+?)(?:\.|$)/i);
    const description = descMatch ? descMatch[1].trim() : part.trim();

    // Determine if critical (codes 1-14 are typically critical)
    const codeNum = parseInt(code);
    const is_critical = codeNum >= 1 && codeNum <= 14;

    return {
      code,
      description,
      is_critical,
    };
  });
}

function createSlug(name: string, license: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base}-${license.slice(-4)}`;
}

// ============================================================================
// CleanPlate Score Calculator v2.0
// Algorithm: Score = (Result × 0.35) + (Violations × 0.25) + (Trend × 0.15) + (TrackRecord × 0.15) + (Recency × 0.10)
// ============================================================================

/**
 * Get risk-adjusted half-life in months for time decay
 */
function getRiskAdjustedHalfLife(riskLevel: number): number {
  switch (riskLevel) {
    case 1: return 6;   // Risk 1: inspected every 6 months
    case 2: return 12;  // Risk 2: inspected every 12 months
    case 3: return 24;  // Risk 3: inspected every 24 months
    default: return 12;
  }
}

/**
 * Get expected inspection interval in days for a risk level
 */
function getExpectedIntervalDays(riskLevel: number): number {
  switch (riskLevel) {
    case 1: return 180;  // 6 months
    case 2: return 365;  // 12 months
    case 3: return 730;  // 24 months
    default: return 365;
  }
}

/**
 * Calculate time decay weight for an inspection
 */
function calculateTimeWeight(monthsSinceInspection: number, riskLevel: number): number {
  const halfLife = getRiskAdjustedHalfLife(riskLevel);
  const lambda = 0.693 / halfLife;
  return Math.exp(-lambda * monthsSinceInspection);
}

/**
 * Calculate risk-adjusted recency score
 */
function calculateRecencyScore(daysSinceInspection: number, riskLevel: number): number {
  const expectedInterval = getExpectedIntervalDays(riskLevel);
  const ratio = daysSinceInspection / expectedInterval;
  
  if (ratio < 0.5) return 100;   // Very recent
  if (ratio <= 1.0) return 85;   // On schedule
  if (ratio <= 1.25) return 60;  // Slightly overdue
  return 40;                      // Overdue
}

/**
 * Get outcome points for an inspection result
 */
function getOutcomePoints(results: string): number {
  const resultLower = results.toLowerCase();
  if (resultLower.includes("pass") && !resultLower.includes("condition") && !resultLower.includes("fail")) {
    return 100;
  } else if (resultLower.includes("condition")) {
    return 70;
  } else if (resultLower.includes("fail")) {
    return 30;
  }
  return 50;
}

/**
 * Calculate months since a given date
 */
function getMonthsSinceDate(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  const dayDiff = now.getDate() - date.getDate();
  return months + (dayDiff / 30);
}

/**
 * Calculate days since a given date
 */
function getDaysSinceInspection(dateStr: string): number {
  const inspectionDate = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - inspectionDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate the Result component (35%) - Time-weighted average of outcomes
 */
function calculateResultScore(inspections: InspectionRecord[], riskLevel: number): number {
  if (inspections.length === 0) return 50;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const insp of inspections) {
    const monthsSince = getMonthsSinceDate(insp.inspection_date);
    const weight = calculateTimeWeight(monthsSince, riskLevel);
    const points = getOutcomePoints(insp.results);
    
    weightedSum += points * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 50;
}

/**
 * Calculate the Violations component (25%)
 */
function calculateViolationsScore(latest: InspectionRecord): number {
  const criticalPenalty = latest.critical_count * 15;
  const nonCriticalPenalty = (latest.violation_count - latest.critical_count) * 5;
  return Math.max(0, 100 - criticalPenalty - nonCriticalPenalty);
}

/**
 * Calculate the Trend component (15%)
 */
function calculateTrendScore(inspections: InspectionRecord[]): number {
  if (inspections.length < 3) return 60; // Default to neutral

  const scores = inspections.slice(0, 4).map(insp => getOutcomePoints(insp.results));
  
  if (scores.length < 3) return 60;

  const recentAvg = (scores[0] + scores[1]) / 2;
  const previousAvg = scores.length >= 4 
    ? (scores[2] + scores[3]) / 2 
    : scores[2];
  
  const trendDelta = recentAvg - previousAvg;

  if (trendDelta >= 30) return 100;       // Strong improvement
  if (trendDelta >= 15) return 85;        // Moderate improvement
  if (trendDelta >= 1) return 70;         // Slight improvement
  if (trendDelta >= -1) return 60;        // Stable
  if (trendDelta >= -14) return 45;       // Slight decline
  if (trendDelta >= -29) return 30;       // Moderate decline
  return 15;                               // Strong decline
}

/**
 * Calculate the Track Record component (15%)
 */
function calculateTrackRecordScore(inspections: InspectionRecord[]): number {
  let penaltyPoints = 0;
  const now = new Date();

  for (const insp of inspections) {
    const inspDate = new Date(insp.inspection_date);
    const monthsAgo = (now.getFullYear() - inspDate.getFullYear()) * 12 + 
                      (now.getMonth() - inspDate.getMonth());
    
    const resultLower = insp.results.toLowerCase();

    // Fail result: +2 penalty, 36 month lookback
    if (resultLower.includes("fail") && monthsAgo <= 36) {
      penaltyPoints += 2;
    }

    // Critical violations: +3 penalty per inspection with criticals, 36 month lookback
    if (insp.critical_count > 0 && monthsAgo <= 36) {
      penaltyPoints += 3;
    }
  }

  const cappedPenalty = Math.min(penaltyPoints, 20);
  return Math.max(0, 100 - (cappedPenalty * 5));
}

/**
 * Calculate pass streak
 */
function getPassStreak(inspections: InspectionRecord[]): number {
  let streak = 0;
  for (const insp of inspections) {
    const r = insp.results.toLowerCase();
    if (r.includes("pass") && !r.includes("condition") && !r.includes("fail")) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Recalculate CleanPlate Score for an establishment
 * 
 * Algorithm v2.0:
 * Score = (Result × 0.35) + (Violations × 0.25) + (Trend × 0.15) + (TrackRecord × 0.15) + (Recency × 0.10)
 */
async function recalculateScore(establishmentId: string, riskLevel: number, supabase: any) {
  try {
    // Fetch recent inspections (get more for track record calculation)
    const { data: inspections } = await supabase
      .from("inspections")
      .select("results, inspection_date, violation_count, critical_count")
      .eq("establishment_id", establishmentId)
      .order("inspection_date", { ascending: false })
      .limit(10);

    if (!inspections || inspections.length === 0) return;

    const latest = inspections[0];
    const daysSince = getDaysSinceInspection(latest.inspection_date);

    // Calculate all components
    const resultScore = calculateResultScore(inspections, riskLevel);
    const violationsScore = calculateViolationsScore(latest);
    const trendScore = calculateTrendScore(inspections);
    const trackRecordScore = calculateTrackRecordScore(inspections);
    const recencyScore = calculateRecencyScore(daysSince, riskLevel);

    // Apply weights: 35/25/15/15/10
    let score = 
      resultScore * 0.35 +
      violationsScore * 0.25 +
      trendScore * 0.15 +
      trackRecordScore * 0.15 +
      recencyScore * 0.10;

    // Apply modifiers
    const passStreak = getPassStreak(inspections);
    if (passStreak >= 3) {
      score += 5; // Bonus for 3+ consecutive passes
    }

    // Penalty for recent failure (within 90 days)
    const hasRecentFailure = inspections.some(
      (insp: InspectionRecord) =>
        insp.results.toLowerCase().includes("fail") &&
        getDaysSinceInspection(insp.inspection_date) <= 90
    );
    if (hasRecentFailure) {
      score -= 10;
    }

    // Clamp to 0-100
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));

    // Update establishment with new score
    await supabase
      .from("establishments")
      .update({
        cleanplate_score: finalScore,
        pass_streak: passStreak,
        updated_at: new Date().toISOString(),
      })
      .eq("id", establishmentId);

    console.log(`Updated score for ${establishmentId}: ${finalScore}`);
  } catch (error) {
    console.error(`Failed to recalculate score for ${establishmentId}:`, error);
  }
}
