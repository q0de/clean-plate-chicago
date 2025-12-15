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

  // TODO: Recalculate CleanPlate score for establishment
  // This would call a database function or trigger
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



