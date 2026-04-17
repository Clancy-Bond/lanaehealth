#!/usr/bin/env node
/**
 * Verification script for the orthostatic_tests table + doctor-brief pipeline.
 *
 * Run: node scripts/verify-orthostatic.mjs
 *
 * Steps:
 *   1. Confirm the orthostatic_tests table exists and is queryable.
 *   2. Insert one synthetic POTS-positive test (will be labelled as a test
 *      row so it's easy to remove later).
 *   3. Fetch /doctor?v=cardiology and confirm POTS hypothesis reflects the
 *      positive test (supporting text should mention "1 of 1 orthostatic
 *      tests positive").
 *   4. Delete the synthetic row.
 *
 * Skips step 2+4 if --no-insert is passed.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const env = {};
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  env[t.slice(0, i)] = t.slice(i + 1);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DEV_URL = process.env.DEV_URL || "http://localhost:3005";
const noInsert = process.argv.includes("--no-insert");

function h(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function main() {
  // Step 1: probe table
  const probe = await fetch(
    `${SUPABASE_URL}/rest/v1/orthostatic_tests?select=id&limit=1`,
    { headers: h() },
  );
  if (!probe.ok) {
    console.error(`[FAIL] orthostatic_tests query: ${probe.status} ${probe.statusText}`);
    const body = await probe.text();
    console.error(body.slice(0, 300));
    process.exit(1);
  }
  console.log("[OK]  orthostatic_tests table exists");

  let insertedId = null;
  if (!noInsert) {
    // Step 2: insert synthetic POTS-positive test
    const insert = await fetch(`${SUPABASE_URL}/rest/v1/orthostatic_tests`, {
      method: "POST",
      headers: h({ Prefer: "return=representation" }),
      body: JSON.stringify({
        test_date: new Date().toISOString().slice(0, 10),
        resting_hr_bpm: 58,
        standing_hr_1min: 88,
        standing_hr_3min: 94,
        standing_hr_5min: 96,
        standing_hr_10min: 98,    // peak_rise = 40 bpm (positive)
        symptoms_experienced: "[VERIFY SCRIPT] synthetic test, safe to delete",
        notes: "[VERIFY SCRIPT] inserted by verify-orthostatic.mjs",
      }),
    });
    if (!insert.ok) {
      console.error(`[FAIL] insert synthetic test: ${insert.status}`);
      console.error((await insert.text()).slice(0, 300));
      process.exit(1);
    }
    const inserted = await insert.json();
    insertedId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
    const peakRise = Array.isArray(inserted)
      ? inserted[0]?.peak_rise_bpm
      : inserted?.peak_rise_bpm;
    console.log(`[OK]  synthetic test inserted (id=${insertedId}, peak_rise=+${peakRise} bpm)`);
  }

  // Step 3: fetch doctor brief and check POTS hypothesis text
  const doctorResp = await fetch(`${DEV_URL}/doctor?v=cardiology&ts=${Date.now()}`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!doctorResp.ok) {
    console.error(`[FAIL] /doctor fetch: ${doctorResp.status}`);
    process.exit(1);
  }
  const html = await doctorResp.text();

  const hasPots = html.includes("Postural Orthostatic Tachycardia Syndrome");
  const hasOrthoRef = /\d+\s+of\s+\d+\s+orthostatic\s+tests\s+positive/i.test(html);
  const hasFormalTest = html.includes("Autonomic function panel") || html.includes("tilt-table");
  console.log(
    `[${hasPots ? "OK" : "FAIL"}]  POTS hypothesis rendered: ${hasPots}`,
  );
  console.log(
    `[${hasOrthoRef ? "OK" : "INFO"}]  References orthostatic test count: ${hasOrthoRef}`,
  );
  console.log(
    `[${hasFormalTest ? "OK" : "INFO"}]  Next-test recommendation adapted: ${hasFormalTest}`,
  );

  // Step 4: cleanup
  if (insertedId && !noInsert) {
    const del = await fetch(
      `${SUPABASE_URL}/rest/v1/orthostatic_tests?id=eq.${insertedId}`,
      { method: "DELETE", headers: h() },
    );
    if (!del.ok) {
      console.warn(`[WARN] cleanup failed: ${del.status} (manual delete needed for id=${insertedId})`);
    } else {
      console.log(`[OK]  synthetic test deleted (id=${insertedId})`);
    }
  }

  console.log("\nVerification complete.");
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
