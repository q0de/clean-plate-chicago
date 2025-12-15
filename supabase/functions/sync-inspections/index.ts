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
        const url = `${CHICAGO_API}?$limit=${BATCH_SIZE}&$offset=${offset}&$order=inspection_date DESC`;
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

  // Check if inspection already exists
  const { data: existingInspection } = await supabase
    .from("inspections")
    .select("id")
    .eq("inspection_id", inspection.inspection_id)
    .single();

  if (existingInspection) {
    // Skip if already exists
    return;
  }

  // Parse violations
  const violations = parseViolations(inspection.violations || "");
  const criticalCount = violations.filter((v) => v.is_critical).length;

  // Create inspection
  const { data: newInspection, error: inspError } = await supabase
    .from("inspections")
    .insert({
      establishment_id: establishmentId,
      inspection_id: inspection.inspection_id,
      inspection_date: inspection.inspection_date.split("T")[0],
      inspection_type: inspection.inspection_type,
      results: inspection.results,
      raw_violations: inspection.violations || null,
      violation_count: violations.length,
      critical_count: criticalCount,
    })
    .select()
    .single();

  if (inspError) {
    throw new Error(`Failed to create inspection: ${inspError.message}`);
  }

  // Create violations
  if (violations.length > 0) {
    const violationRecords = violations.map((v) => ({
      inspection_id: newInspection.id,
      violation_code: v.code,
      violation_description: v.description,
      violation_comment: v.comment || null,
      is_critical: v.is_critical,
      plain_english: v.plain_english || null,
    }));

    const { error: violError } = await supabase
      .from("violations")
      .insert(violationRecords);

    if (violError) {
      console.error("Failed to create violations:", violError);
    }
  }

  // Recalculate CleanPlate score for establishment
  await recalculateScore(establishmentId, supabase);
}

function parseViolations(violationsString: string): Array<{
  code: string;
  description: string;
  comment?: string;
  is_critical: boolean;
  plain_english?: string;
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

/**
 * Recalculate CleanPlate Score for an establishment based on recent inspections
 */
async function recalculateScore(establishmentId: string, supabase: any) {
  try {
    // Fetch establishment with risk level
    const { data: establishment } = await supabase
      .from("establishments")
      .select("risk_level")
      .eq("id", establishmentId)
      .single();

    if (!establishment) return;

    // Fetch recent inspections (last 5 for trend calculation)
    const { data: inspections } = await supabase
      .from("inspections")
      .select("results, inspection_date, violation_count, critical_count")
      .eq("establishment_id", establishmentId)
      .order("inspection_date", { ascending: false })
      .limit(5);

    if (!inspections || inspections.length === 0) return;

    const latest = inspections[0];
    const riskLevel = establishment.risk_level || 2;

    // Calculate score components
    const score = calculateCleanPlateScore(latest, inspections, riskLevel);

    // Calculate pass streak
    let passStreak = 0;
    for (const insp of inspections) {
      const result = insp.results.toLowerCase();
      if (result.includes("pass") && !result.includes("fail")) {
        passStreak++;
      } else {
        break;
      }
    }

    // Update establishment with new score
    await supabase
      .from("establishments")
      .update({
        cleanplate_score: score,
        pass_streak: passStreak,
        updated_at: new Date().toISOString(),
      })
      .eq("id", establishmentId);

    console.log(`Updated score for ${establishmentId}: ${score}`);
  } catch (error) {
    console.error(`Failed to recalculate score for ${establishmentId}:`, error);
  }
}

/**
 * Calculate CleanPlate Score based on PRD formula:
 * Score = (Result × 0.40) + (Trend × 0.20) + (Violations × 0.20) + (Recency × 0.10) + (Risk × 0.10)
 */
function calculateCleanPlateScore(
  latest: { results: string; inspection_date: string; violation_count: number; critical_count: number },
  inspections: Array<{ results: string; inspection_date: string; violation_count: number; critical_count: number }>,
  riskLevel: number
): number {
  // Result component (40%)
  let resultScore = 50;
  const resultLower = latest.results.toLowerCase();
  if (resultLower.includes("pass") && !resultLower.includes("condition") && !resultLower.includes("fail")) {
    resultScore = 100;
  } else if (resultLower.includes("condition")) {
    resultScore = 70;
  } else if (resultLower.includes("fail")) {
    resultScore = 30;
  }

  // Trend component (20%)
  let trendScore = 0;
  if (inspections.length >= 3) {
    const last3 = inspections.slice(0, 3);
    const scores = last3.map((insp) => {
      const r = insp.results.toLowerCase();
      if (r.includes("pass") && !r.includes("condition") && !r.includes("fail")) return 100;
      if (r.includes("condition")) return 70;
      if (r.includes("fail")) return 30;
      return 50;
    });

    const first = scores[2];
    const middle = scores[1];
    const last = scores[0];

    if (last > middle && middle > first) trendScore = 10; // improving
    else if (last < middle && middle < first) trendScore = -10; // declining
  }

  // Violations component (20%)
  const violationsScore = Math.max(
    0,
    100 - (latest.critical_count * 15) - ((latest.violation_count - latest.critical_count) * 5)
  );

  // Recency component (10%)
  const daysSince = getDaysSinceInspection(latest.inspection_date);
  let recencyScore = 20;
  if (daysSince < 180) recencyScore = 100;
  else if (daysSince < 365) recencyScore = 80;
  else if (daysSince < 540) recencyScore = 50;

  // Risk component (10%) - lower risk level = better score
  let riskScore = 80;
  if (riskLevel === 3) riskScore = 100;
  else if (riskLevel === 2) riskScore = 80;
  else if (riskLevel === 1) riskScore = 60;

  // Calculate base score
  let score =
    resultScore * 0.40 +
    trendScore * 0.20 +
    violationsScore * 0.20 +
    recencyScore * 0.10 +
    riskScore * 0.10;

  // Apply modifiers
  const passStreak = getPassStreak(inspections);
  if (passStreak >= 3) {
    score += 5;
  }

  if (daysSince > 540) {
    score -= 20;
  }

  const hasRecentFailure = inspections.some(
    (insp) =>
      insp.results.toLowerCase().includes("fail") &&
      getDaysSinceInspection(insp.inspection_date) <= 90
  );
  if (hasRecentFailure) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getPassStreak(inspections: Array<{ results: string }>): number {
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

function getDaysSinceInspection(date: string): number {
  const inspectionDate = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - inspectionDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}



