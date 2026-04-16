/**
 * Parse and import Adventist Health CCD/CCDA XML
 *
 * Reads: /Users/clancybond/Downloads/LANAE BOND_health-summary.xml (507KB)
 * Sections parsed: Problems, Medications, Lab Results, Vital Signs, Encounters, Allergies
 * Smart dedup: compares against existing Supabase data before inserting
 *
 * Usage: cd /Users/clancybond/lanaehealth && node src/lib/migrations/parse-ccd-import.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Load env ---
const envPath = resolve(__dirname, '../../../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// --- Read CCD XML ---
const CCD_PATH = '/Users/clancybond/Downloads/LANAE BOND_health-summary.xml';
const xml = readFileSync(CCD_PATH, 'utf-8');

// --- Summary counters ---
const summary = {
  sections_found: [],
  labs: { found: 0, new: 0, skipped: 0, details: [] },
  vitals: { found: 0, new: 0, skipped: 0, details: [] },
  problems: { found: 0, new: 0, skipped: 0, details: [] },
  medications: { found: 0, new: 0, skipped: 0, details: [] },
  encounters: { found: 0, new: 0, skipped: 0, details: [] },
  allergies: { found: 0, details: [] },
  notable: [],
};

// --- Utility: decode HTML entities ---
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// --- Utility: strip HTML tags ---
function stripTags(s) {
  return s.replace(/<[^>]+>/g, '');
}

// --- Utility: clean value string (strip footnote superscript numbers) ---
function cleanValue(raw) {
  // Remove trailing footnote references embedded in CCD HTML
  // "50.4 ng/mL1" -> "50.4 ng/mL"
  // "0.03 17" -> "0.03"  (space + footnote number)
  // ">90 mL/min/1.73m29, 10" -> ">90 mL/min/1.73m2"
  // "*HI*" markers from vitals
  let cleaned = raw.replace(/\*HI\*|\*LO\*/g, '').trim();
  // Remove trailing footnote numbers (standalone digits after a space or at end)
  cleaned = cleaned.replace(/\s+\d+(?:,\s*\d+)*\s*$/, '').trim();
  // Remove footnote digits glued to end of units (e.g., "ng/mL1" -> "ng/mL")
  cleaned = cleaned.replace(/([a-zA-Z/%])(\d+(?:,\s*\d+)*)$/, '$1').trim();
  return cleaned;
}

// --- Utility: parse numeric value from string like "50.4 ng/mL" ---
function parseNumericValue(raw) {
  const cleaned = cleanValue(raw);
  // Handle ">90", "<0.5" style values
  const match = cleaned.match(/^[<>]?\s*([\d.]+)/);
  if (match) return parseFloat(match[1]);
  // Handle "Negative" or qualitative values
  if (/negative/i.test(cleaned)) return 0;
  return null;
}

// --- Utility: parse unit from value string ---
function parseUnit(raw) {
  const cleaned = cleanValue(raw);
  // Remove leading number and optional < > =
  const match = cleaned.match(/^[<>]?\s*[\d.]+\s*(.+)$/);
  if (match) return match[1].trim();
  return '';
}

// --- Utility: parse reference range "(Normal is X-Y unit)" ---
function parseRefRange(ref) {
  if (!ref) return { low: null, high: null };
  const decoded = decodeEntities(ref);

  // "(Normal is 11.0-306.8 ng/mL)"
  let m = decoded.match(/Normal is\s+([\d.]+)\s*-\s*([\d.]+)/);
  if (m) return { low: parseFloat(m[1]), high: parseFloat(m[2]) };

  // "(Normal is <=2.0 %)" or "(Normal is <500 ...)"
  m = decoded.match(/Normal is\s*[<≤]=?\s*([\d.]+)/);
  if (m) return { low: null, high: parseFloat(m[1]) };

  // "(Normal is >5.8 ng/mL)" or "(Normal is >=30)"
  m = decoded.match(/Normal is\s*[>≥]=?\s*([\d.]+)/);
  if (m) return { low: parseFloat(m[1]), high: null };

  // "(Normal is 0.01-0.08)" without unit
  m = decoded.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (m) return { low: parseFloat(m[1]), high: parseFloat(m[2]) };

  return { low: null, high: null };
}

// --- Utility: compute flag ---
function computeFlag(value, refLow, refHigh) {
  if (value == null) return 'normal';
  if (refLow != null && value < refLow) return 'low';
  if (refHigh != null && value > refHigh) return 'high';
  return 'normal';
}

// --- Utility: convert short date "4/13/26" to ISO "2026-04-13" ---
function shortDateToISO(s) {
  const parts = s.split('/');
  if (parts.length !== 3) return null;
  let [month, day, year] = parts.map(Number);
  if (year < 100) year += 2000;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// --- Utility: categorize a lab test ---
function categorizeLab(testName) {
  const n = testName.toLowerCase();
  if (/wbc|rbc|hgb|hct|mcv|mch|mchc|rdw|plt|mpv|basophil|eosinophil|lymphocyte|monocyte|neutrophil|immature gran|retic/i.test(n)) return 'Hematology';
  if (/ferritin|iron|transferrin|tibc/i.test(n)) return 'Iron Studies';
  if (/sodium|potassium|chloride|co2|carbon dioxide|bun|creatinine|glucose|calcium|magnesium|phosph|anion gap|osmolal|egfr|bun\/creat/i.test(n)) return 'Chemistry';
  if (/albumin|protein|globulin|a\/g ratio|alp|alt|ast|bilirubin/i.test(n)) return 'Liver/Protein';
  if (/tsh|thyroid|t3|t4|free t/i.test(n)) return 'Thyroid';
  if (/cholesterol|ldl|hdl|triglycerid|lipid/i.test(n)) return 'Lipids';
  if (/vitamin|folate|b12/i.test(n)) return 'Vitamins';
  if (/d-dimer|pt |inr|aptt|fibrinogen/i.test(n)) return 'Coagulation';
  if (/bhcg|pregnancy/i.test(n)) return 'Reproductive';
  if (/crp|esr|sed rate|complement|c1 esterase|ige|immunoglob/i.test(n)) return 'Immunology';
  return 'Other';
}

// =============================================
// SECTION PARSERS
// =============================================

// --- Section finder helper ---
function findSection(title) {
  const titleIdx = xml.indexOf(`<title>${title}</title>`);
  if (titleIdx === -1) return null;
  summary.sections_found.push(title);
  return titleIdx;
}

// =============================================
// 1. PARSE LAB RESULTS
// =============================================
function parseLabResults() {
  const startIdx = findSection('Results');
  if (startIdx == null) { console.log('Results section not found'); return []; }

  const endIdx = xml.indexOf('<title>', startIdx + 100);
  const section = xml.substring(startIdx, endIdx > 0 ? endIdx : startIdx + 300000);

  const results = [];
  const datePattern = /<caption>(\d+\/\d+\/\d+)<\/caption>/g;
  const dateMatches = [...section.matchAll(datePattern)];

  for (let i = 0; i < dateMatches.length; i++) {
    const dateStr = dateMatches[i][1];
    const isoDate = shortDateToISO(dateStr);
    if (!isoDate) continue;

    const start = dateMatches[i].index + dateMatches[i][0].length;
    const end = i + 1 < dateMatches.length ? dateMatches[i + 1].index : section.length;
    const dateSection = section.substring(start, end);

    // Parse each result row
    const rowPattern = /<content ID="RESEVN\d+">([^<]+)<\/content><\/td><td[^>]*>(.*?)<\/td><td>(.*?)<\/td>/gs;
    for (const match of dateSection.matchAll(rowPattern)) {
      const testName = match[1].trim();
      const valCell = decodeEntities(stripTags(match[2]).trim());
      const refCell = decodeEntities(stripTags(match[3]).trim());

      const numValue = parseNumericValue(valCell);
      const unit = parseUnit(valCell);
      const { low: refLow, high: refHigh } = parseRefRange(refCell);
      const flag = computeFlag(numValue, refLow, refHigh);
      const category = categorizeLab(testName);

      results.push({
        date: isoDate,
        test_name: testName,
        value: numValue,
        unit: unit || null,
        reference_range_low: refLow,
        reference_range_high: refHigh,
        flag,
        category,
        raw_value: cleanValue(valCell),
      });
    }
  }

  summary.labs.found = results.length;
  return results;
}

// =============================================
// 2. PARSE VITAL SIGNS
// =============================================
function parseVitalSigns() {
  const startIdx = findSection('Vital Signs');
  if (startIdx == null) { console.log('Vital Signs section not found'); return []; }

  const endIdx = xml.indexOf('<title>', startIdx + 100);
  const section = xml.substring(startIdx, endIdx > 0 ? endIdx : startIdx + 100000);

  const vitals = [];
  const datePattern = /<paragraph>(\d+\/\d+\/\d+)<\/paragraph>/g;
  const dateMatches = [...section.matchAll(datePattern)];

  for (let i = 0; i < dateMatches.length; i++) {
    const dateStr = dateMatches[i][1];
    const isoDate = shortDateToISO(dateStr);
    if (!isoDate) continue;

    const start = dateMatches[i].index + dateMatches[i][0].length;
    const end = i + 1 < dateMatches.length ? dateMatches[i + 1].index : section.length;
    const dateSection = section.substring(start, end);

    // Parse individual vitals (non-BP)
    const vitalPattern = /<content ID="VSEVN\d+">([^<]+)<\/content><\/td><td[^>]*>(.*?)<\/td><td>(.*?)<\/td>/gs;
    for (const match of dateSection.matchAll(vitalPattern)) {
      const name = match[1].trim();
      const valCell = decodeEntities(stripTags(match[2]).trim());
      const refCell = decodeEntities(stripTags(match[3]).trim());

      // Skip non-numeric vitals (sites, methods, delivery modes)
      if (/site|position|location|method|delivery|measured method/i.test(name)) continue;

      const numValue = parseNumericValue(valCell);
      const unit = parseUnit(valCell);
      const { low: refLow, high: refHigh } = parseRefRange(refCell);

      vitals.push({
        date: isoDate,
        vital_name: name,
        value: numValue,
        unit: unit || null,
        reference_range_low: refLow,
        reference_range_high: refHigh,
        raw_value: cleanValue(valCell),
      });
    }

    // Parse Blood Pressure (compound format)
    const bpPattern = /<td>Blood Pressure<\/td><td[^>]*><content ID="VSEVN\d+">(\d+)<\/content>\/<content ID="VSEVN\d+">(\d+)<\/content> mmHg<\/td>/g;
    for (const match of dateSection.matchAll(bpPattern)) {
      vitals.push({
        date: isoDate,
        vital_name: 'Systolic Blood Pressure',
        value: parseInt(match[1]),
        unit: 'mmHg',
        reference_range_low: 90,
        reference_range_high: 139,
        raw_value: match[1] + ' mmHg',
      });
      vitals.push({
        date: isoDate,
        vital_name: 'Diastolic Blood Pressure',
        value: parseInt(match[2]),
        unit: 'mmHg',
        reference_range_low: 60,
        reference_range_high: 89,
        raw_value: match[2] + ' mmHg',
      });
    }
  }

  summary.vitals.found = vitals.length;
  return vitals;
}

// =============================================
// 3. PARSE PROBLEMS
// =============================================
function parseProblems() {
  const startIdx = findSection('Problem List');
  if (startIdx == null) { console.log('Problem List section not found'); return []; }

  const endIdx = xml.indexOf('<title>', startIdx + 100);
  const section = xml.substring(startIdx, endIdx > 0 ? endIdx : startIdx + 100000);

  const problems = [];
  // Extract from the HTML table (most reliable for this CCD)
  const rowPattern = /<content ID="PROBLEM\d+">([^<]+)<\/content>.*?<content ID="CON\d+">([^<]+)<\/content>.*?<content ID="PROBST\d+">([^<]+)<\/content>/gs;
  for (const match of section.matchAll(rowPattern)) {
    problems.push({
      name: match[1].trim(),
      confirmation: match[2].trim(),
      status: match[3].trim().toLowerCase(),
    });
  }

  // Also extract SNOMED codes from structured entries
  const snomedPattern = /<value[^>]*code="(\d+)"[^>]*codeSystem="2\.16\.840\.1\.113883\.6\.96"[^>]*displayName="([^"]+)"/g;
  const snomedCodes = {};
  for (const match of section.matchAll(snomedPattern)) {
    const name = match[2];
    if (!snomedCodes[name]) {
      snomedCodes[name] = match[1];
    }
  }

  // Merge SNOMED codes into problems
  for (const prob of problems) {
    for (const [snomedName, code] of Object.entries(snomedCodes)) {
      if (snomedName.toLowerCase().includes(prob.name.toLowerCase()) ||
          prob.name.toLowerCase().includes(snomedName.toLowerCase().split(' ')[0])) {
        prob.snomed_code = code;
        prob.snomed_name = snomedName;
        break;
      }
    }
  }

  summary.problems.found = problems.length;
  return problems;
}

// =============================================
// 4. PARSE MEDICATIONS
// =============================================
function parseMedications() {
  const startIdx = findSection('Medications');
  if (startIdx == null) { console.log('Medications section not found'); return []; }

  const endIdx = xml.indexOf('<title>', startIdx + 100);
  const section = xml.substring(startIdx, endIdx > 0 ? endIdx : startIdx + 20000);

  const meds = [];

  // Parse from HTML table (cleaner)
  const medPattern = /<content ID="MEDPROD\d+"[^>]*>([^<]+)<\/content>.*?Status:\s*(\w+).*?Start Date:\s*([\d/]+).*?<content ID="MEDSIG\d+">([^<]+)<\/content>/gs;
  for (const match of section.matchAll(medPattern)) {
    meds.push({
      name: match[1].trim(),
      status: match[2].trim(),
      start_date: match[3].trim(),
      sig: match[4].trim(),
    });
  }

  // Also extract RxNorm codes from structured entries
  const rxPattern = /displayName="([^"]+)"[^>]*>.*?<originalText><reference value="#MEDPROD/gs;
  // Simpler: get from manufacturedMaterial code
  const rxPattern2 = /<code code="(\d+)"[^>]*codeSystem="2\.16\.840\.1\.113883\.6\.88"[^>]*displayName="([^"]+)"/g;
  for (const match of section.matchAll(rxPattern2)) {
    const rxNorm = match[1];
    const rxName = match[2];
    // Try to match to existing med
    for (const med of meds) {
      if (rxName.toLowerCase().includes(med.name.split(' ')[0].toLowerCase()) ||
          med.name.toLowerCase().includes(rxName.split(' ')[0].toLowerCase())) {
        med.rxnorm_code = rxNorm;
        med.rxnorm_name = rxName;
        break;
      }
    }
  }

  summary.medications.found = meds.length;
  return meds;
}

// =============================================
// 5. PARSE ENCOUNTERS
// =============================================
function parseEncounters() {
  const startIdx = findSection('Encounter(s)');
  if (startIdx == null) { console.log('Encounters section not found'); return []; }

  const endIdx = xml.indexOf('<title>', startIdx + 100);
  const section = xml.substring(startIdx, endIdx > 0 ? endIdx : startIdx + 20000);

  const encounters = [];

  // Parse from paragraphs
  const encPattern = /<paragraph ID="ENCOUNTER\d+"><content styleCode="Bold">([^<]+)<\/content><br\/>([^<]+)<br\/>(?:Attending Physician:\s*([^<]+)<br\/>)?.*?<content styleCode="Bold">Encounter Type:\s*([^<]+)<\/content>/gs;
  for (const match of section.matchAll(encPattern)) {
    const headerLine = match[1].trim();
    const facility = match[2].trim();
    const attending = match[3] ? match[3].trim() : null;
    const encType = match[4].trim();

    // Extract date from "45 Acct XXXXX Date(s): M/D/YY"
    const dateMatch = headerLine.match(/Date\(s\):\s*(\d+\/\d+\/\d+)/);
    const dateStr = dateMatch ? dateMatch[1] : null;
    const isoDate = dateStr ? shortDateToISO(dateStr) : null;

    // Extract encounter diagnoses if present
    const diagStart = section.indexOf(match[0]);
    const diagEnd = section.indexOf('</paragraph>', diagStart);
    const encBlock = section.substring(diagStart, diagEnd);
    const diagPattern = /<content ID="ENCDIAG\d+">([^<]+)<\/content>/g;
    const diagnoses = [];
    for (const dm of encBlock.matchAll(diagPattern)) {
      diagnoses.push(dm[1].trim());
    }

    encounters.push({
      date: isoDate,
      facility: facility.split(' US ')[0].split(' (')[0].trim(),
      attending,
      type: encType,
      diagnoses,
      raw_header: headerLine,
    });
  }

  summary.encounters.found = encounters.length;
  return encounters;
}

// =============================================
// 6. PARSE ALLERGIES
// =============================================
function parseAllergies() {
  const startIdx = findSection('Allergies, Adverse Reactions, Alerts');
  if (startIdx == null) { console.log('Allergies section not found'); return []; }

  const endIdx = xml.indexOf('<title>', startIdx + 100);
  const section = xml.substring(startIdx, endIdx > 0 ? endIdx : startIdx + 5000);

  // Check for NKMA (No Known Medication Allergies)
  if (section.includes('No Known Medication Allergies') || section.includes('NKMA')) {
    summary.allergies.found = 0;
    summary.allergies.details.push('No Known Medication Allergies (confirmed in CCD)');
    return [];
  }

  return [];
}

// =============================================
// DEDUPLICATION AND IMPORT
// =============================================

async function importLabResults(labResults) {
  if (labResults.length === 0) return;

  console.log(`\n=== Importing Lab Results (${labResults.length} found) ===\n`);

  // Get all existing labs grouped by date+test_name
  const dates = [...new Set(labResults.map(l => l.date))];
  const existingByKey = new Map();

  for (const date of dates) {
    const { data: existing } = await supabase
      .from('lab_results')
      .select('test_name, value, unit')
      .eq('date', date);

    for (const e of (existing || [])) {
      const key = `${date}|${e.test_name.toLowerCase()}`;
      existingByKey.set(key, e);
    }
  }

  const toInsert = [];
  for (const lab of labResults) {
    const key = `${lab.date}|${lab.test_name.toLowerCase()}`;

    // Also check common name variations
    const altNames = getAltLabNames(lab.test_name);
    const anyExists = existingByKey.has(key) || altNames.some(alt => {
      const altKey = `${lab.date}|${alt.toLowerCase()}`;
      return existingByKey.has(altKey);
    });

    if (anyExists) {
      summary.labs.skipped++;
      continue;
    }

    // Skip if value is null and not a qualitative test
    if (lab.value == null && !/negative|positive|reactive|non-reactive/i.test(lab.raw_value)) {
      summary.labs.skipped++;
      continue;
    }

    toInsert.push({
      date: lab.date,
      category: lab.category,
      test_name: lab.test_name,
      value: lab.value,
      unit: lab.unit,
      reference_range_low: lab.reference_range_low,
      reference_range_high: lab.reference_range_high,
      flag: lab.flag,
    });
  }

  if (toInsert.length > 0) {
    console.log(`  Inserting ${toInsert.length} new lab results...`);
    for (const lab of toInsert) {
      console.log(`    [${lab.date}] ${lab.test_name}: ${lab.value} ${lab.unit || ''} (${lab.flag})`);
      summary.labs.details.push(`[NEW] ${lab.date} ${lab.test_name}: ${lab.value} ${lab.unit || ''}`);
    }

    const { error } = await supabase.from('lab_results').insert(toInsert);
    if (error) {
      console.error('  ERROR inserting labs:', error.message);
    } else {
      summary.labs.new = toInsert.length;
      console.log(`  Successfully inserted ${toInsert.length} labs.`);
    }
  } else {
    console.log('  All lab results already exist in database. Nothing to insert.');
  }
}

// --- Name variations for dedup matching ---
function getAltLabNames(name) {
  const map = {
    'Auto Basophil Percent': ['Basophils %', 'Basophil Percent'],
    'Auto Basophil Absolute': ['Basophils Abs', 'Basophil Absolute'],
    'Auto Eosinophil Percent': ['Eosinophils %', 'Eosinophil Percent'],
    'Auto Eosinophil Absolute': ['Eosinophils Abs', 'Eosinophil Absolute'],
    'Auto Lymphocyte Percent': ['Lymphocytes %', 'Lymphocyte Percent'],
    'Auto Lymphocyte Absolute': ['Lymphocytes Abs', 'Lymphocyte Absolute'],
    'Auto Monocyte Percent': ['Monocytes %', 'Monocyte Percent'],
    'Auto Monocyte Absolute': ['Monocytes Abs', 'Monocyte Absolute'],
    'Auto Neutrophil Percent': ['Neutrophils %', 'Neutrophil Percent'],
    'Auto Neutrophil Absolute': ['Neutrophils Abs', 'Neutrophil Absolute'],
    'Immature Grans Abs': ['Immature Granulocytes Abs'],
    'Immature Granulocytes': ['Immature Granulocytes %'],
    'HGB': ['Hemoglobin (HGB)', 'Hemoglobin', 'HGB'],
    'HCT': ['Hematocrit (HCT)', 'Hematocrit', 'HCT'],
    'PLT': ['Platelets (PLT)', 'Platelets', 'PLT'],
    'WBC': ['WBC'],
    'RBC': ['RBC'],
    'MCV': ['MCV'],
    'MCH': ['MCH'],
    'MCHC': ['MCHC'],
    'RDW': ['RDW'],
    'MPV': ['MPV'],
    'Calcium Level': ['Calcium', 'Calcium Level'],
    'Sodium Level': ['Sodium', 'Sodium Level'],
    'Potassium Level': ['Potassium', 'Potassium Level'],
    'Chloride Level': ['Chloride', 'Chloride Level'],
    'Magnesium Level': ['Magnesium', 'Magnesium Level'],
    'Albumin Level': ['Albumin', 'Albumin Level'],
    'Ferritin Level': ['Ferritin', 'Ferritin Level'],
    'Iron Level': ['Iron', 'Iron Total', 'Iron Level'],
    'Transferrin Level': ['Transferrin', 'Transferrin Level'],
    'Vitamin B12 Level': ['Vitamin B12', 'B12', 'Vitamin B12 Level'],
    'Folate Level': ['Folate', 'Folate Level'],
    'CO2/Carbon Dioxide': ['CO2', 'Carbon Dioxide', 'CO2/Carbon Dioxide'],
    'Glucose, Random': ['Glucose', 'Glucose, Random'],
    'Creatinine': ['Creatinine'],
    'BUN': ['BUN'],
    'Anion Gap': ['Anion Gap'],
    'TSH Thyroid Stim Hormone 3RD Generation': ['TSH', 'TSH Thyroid Stim Hormone 3RD Generation'],
    'D-Dimer, Qnt': ['D-Dimer', 'D-Dimer, Qnt'],
    'Osmolality, Calculated': ['Osmolality', 'Osmolality, Calculated'],
    'BUN/Creat Ratio': ['BUN/Creatinine Ratio', 'BUN/Creat Ratio'],
    'A/G Ratio': ['A/G Ratio', 'Albumin/Globulin Ratio'],
    'ALP': ['Alkaline Phosphatase', 'ALP'],
    'ALT': ['ALT'],
    'AST': ['AST'],
    'Bilirubin, Total': ['Bilirubin Total', 'Total Bilirubin', 'Bilirubin, Total'],
    'Total Protein': ['Total Protein', 'Protein, Total'],
    'Globulin Level': ['Globulin', 'Globulin Level'],
    'BHCG/Pregnancy, Serum QUAL': ['BHCG/Pregnancy', 'BHCG/Pregnancy, Serum QUAL', 'Pregnancy Test'],
    'Retic, pct': ['Reticulocyte %', 'Retic, pct', 'Reticulocyte Count'],
    'eGFR': ['eGFR', 'GFR'],
    'MAP Non-Invasive': ['MAP', 'Mean Arterial Pressure'],
  };
  return map[name] || [];
}

async function importVitalsAsLabs(vitals) {
  if (vitals.length === 0) return;

  console.log(`\n=== Importing Vital Signs as Lab Results (${vitals.length} found) ===\n`);

  // Filter to only meaningful vitals
  const meaningful = vitals.filter(v => {
    const n = v.vital_name.toLowerCase();
    return (
      n.includes('pulse') ||
      n.includes('heart rate') ||
      n.includes('temperature') ||
      n.includes('respiratory') ||
      n.includes('blood pressure') ||
      n.includes('weight') ||
      n.includes('bmi') ||
      n.includes('height') ||
      n.includes('oxygen') ||
      n.includes('map ')
    ) && v.value != null;
  });

  // Get existing vitals
  const dates = [...new Set(meaningful.map(v => v.date))];
  const existingByKey = new Map();

  for (const date of dates) {
    const { data: existing } = await supabase
      .from('lab_results')
      .select('test_name, value')
      .eq('date', date)
      .eq('category', 'Vital Signs');

    for (const e of (existing || [])) {
      const key = `${date}|${e.test_name.toLowerCase()}`;
      existingByKey.set(key, e);
    }
  }

  const toInsert = [];
  for (const v of meaningful) {
    const key = `${v.date}|${v.vital_name.toLowerCase()}`;
    const altNames = getAltLabNames(v.vital_name);
    const anyExists = existingByKey.has(key) || altNames.some(alt => {
      return existingByKey.has(`${v.date}|${alt.toLowerCase()}`);
    });

    if (anyExists) {
      summary.vitals.skipped++;
      continue;
    }

    toInsert.push({
      date: v.date,
      category: 'Vital Signs',
      test_name: v.vital_name,
      value: v.value,
      unit: v.unit,
      reference_range_low: v.reference_range_low || null,
      reference_range_high: v.reference_range_high || null,
      flag: computeFlag(v.value, v.reference_range_low, v.reference_range_high),
    });
  }

  // Deduplicate within the insert batch (take first occurrence)
  const seen = new Set();
  const deduped = [];
  for (const v of toInsert) {
    const key = `${v.date}|${v.test_name}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(v);
    }
  }

  if (deduped.length > 0) {
    console.log(`  Inserting ${deduped.length} new vital sign records...`);
    for (const v of deduped) {
      console.log(`    [${v.date}] ${v.test_name}: ${v.value} ${v.unit || ''}`);
      summary.vitals.details.push(`[NEW] ${v.date} ${v.test_name}: ${v.value} ${v.unit || ''}`);
    }

    const { error } = await supabase.from('lab_results').insert(deduped);
    if (error) {
      console.error('  ERROR inserting vitals:', error.message);
    } else {
      summary.vitals.new = deduped.length;
      console.log(`  Successfully inserted ${deduped.length} vitals.`);
    }
  } else {
    console.log('  All vital signs already exist in database. Nothing to insert.');
  }
}

async function importEncounters(encounters) {
  if (encounters.length === 0) return;

  console.log(`\n=== Processing Encounters (${encounters.length} found) ===\n`);

  // Check existing timeline events
  const { data: existingTimeline } = await supabase
    .from('medical_timeline')
    .select('event_date, title, event_type');

  const existingSet = new Set(
    (existingTimeline || []).map(t => `${t.event_date}|${t.title.toLowerCase().slice(0, 30)}`)
  );

  const toInsert = [];
  for (const enc of encounters) {
    if (!enc.date) continue;

    // Map encounter type to timeline event type
    let eventType = 'appointment';
    if (enc.type === 'Emergency') eventType = 'hospitalization';
    else if (enc.type === 'Clinic') eventType = 'appointment';
    else if (enc.type === 'Between Visit') eventType = 'appointment';

    const title = enc.attending
      ? `${enc.type} visit with ${enc.attending} at ${enc.facility.split(' ').slice(0, 3).join(' ')}`
      : `${enc.type} visit at ${enc.facility.split(' ').slice(0, 3).join(' ')}`;

    // Check if something similar already exists for this date
    const checkKey = `${enc.date}|${title.toLowerCase().slice(0, 30)}`;
    const dateExists = (existingTimeline || []).some(t =>
      t.event_date === enc.date &&
      (t.title.toLowerCase().includes(enc.facility.split(' ')[1]?.toLowerCase() || 'NOPE') ||
       t.title.toLowerCase().includes(enc.type.toLowerCase()))
    );

    if (dateExists || existingSet.has(checkKey)) {
      console.log(`  SKIP (exists): [${enc.date}] ${title}`);
      summary.encounters.skipped++;
      continue;
    }

    const description = enc.diagnoses.length > 0
      ? `Encounter diagnoses: ${enc.diagnoses.join(', ')}. Facility: ${enc.facility}.`
      : `Facility: ${enc.facility}. Type: ${enc.type}.`;

    toInsert.push({
      event_date: enc.date,
      event_type: eventType,
      title,
      description: description.replace(/\u2014/g, ' - '), // No em dashes
      significance: enc.diagnoses.length > 0 ? 'important' : 'normal',
      linked_data: {
        source: 'CCD import',
        facility: enc.facility,
        encounter_type: enc.type,
        attending: enc.attending,
        diagnoses: enc.diagnoses,
      },
    });
  }

  if (toInsert.length > 0) {
    console.log(`  Inserting ${toInsert.length} new timeline events from encounters...`);
    for (const e of toInsert) {
      console.log(`    [${e.event_date}] ${e.title}`);
      summary.encounters.details.push(`[NEW] ${e.event_date} ${e.title}`);
    }

    const { error } = await supabase.from('medical_timeline').insert(toInsert);
    if (error) {
      console.error('  ERROR inserting encounters:', error.message);
    } else {
      summary.encounters.new = toInsert.length;
      console.log(`  Successfully inserted ${toInsert.length} encounter events.`);
    }
  } else {
    console.log('  All encounters already represented in timeline. Nothing to insert.');
  }
}

async function checkProblems(problems) {
  if (problems.length === 0) return;

  console.log(`\n=== Checking Problems (${problems.length} found) ===\n`);

  const { data: existing } = await supabase.from('active_problems').select('problem');
  const existingNames = new Set(
    (existing || []).map(p => (p.problem || '').toLowerCase())
  );

  for (const prob of problems) {
    const nameLC = prob.name.toLowerCase();
    const isExisting = existingNames.has(nameLC) ||
      [...existingNames].some(e =>
        e.includes(nameLC) || nameLC.includes(e.split(' ')[0])
      );

    if (isExisting) {
      console.log(`  EXISTS: ${prob.name} [${prob.status}] ${prob.snomed_code ? '(SNOMED: ' + prob.snomed_code + ')' : ''}`);
      summary.problems.skipped++;
    } else {
      console.log(`  NEW: ${prob.name} [${prob.status}] ${prob.snomed_code ? '(SNOMED: ' + prob.snomed_code + ')' : ''}`);
      summary.problems.new++;
      summary.problems.details.push(`[NEW] ${prob.name} (${prob.status})`);
    }
  }

  // Problems are complex - we already have detailed problem records
  // The CCD problems are simpler (just names + status), so we log but don't insert
  // since active_problems already has richer data with linked diagnoses, symptoms, notes
  if (summary.problems.new > 0) {
    console.log(`\n  Note: ${summary.problems.new} new problem(s) detected but NOT auto-inserted.`);
    console.log('  Active problems table already has richer data with linked diagnoses and notes.');
    console.log('  Review manually if these should be added.');
  }
}

async function checkMedications(meds) {
  if (meds.length === 0) return;

  console.log(`\n=== Checking Medications (${meds.length} found) ===\n`);

  // Read existing health_profile medications section
  const { data: profile } = await supabase
    .from('health_profile')
    .select('content')
    .eq('section', 'medications')
    .single();

  const existingMeds = profile?.content?.current || [];
  const existingNames = existingMeds.map(m => m.name.toLowerCase());

  for (const med of meds) {
    const nameLC = med.name.toLowerCase();
    const isExisting = existingNames.some(e =>
      e.includes(nameLC.split(' ')[0]) || nameLC.includes(e.split(' ')[0])
    );

    if (isExisting) {
      console.log(`  EXISTS: ${med.name} (${med.status}, started ${med.start_date})`);
      console.log(`    Sig: ${med.sig}`);
      if (med.rxnorm_code) console.log(`    RxNorm: ${med.rxnorm_code} - ${med.rxnorm_name}`);
      summary.medications.skipped++;
    } else {
      console.log(`  NEW: ${med.name} (${med.status}, started ${med.start_date})`);
      summary.medications.new++;
      summary.medications.details.push(`[NEW] ${med.name}`);
    }
  }
}

// =============================================
// MAIN
// =============================================
async function main() {
  console.log('='.repeat(70));
  console.log('  ADVENTIST HEALTH CCD/CCDA IMPORT');
  console.log('  File: ' + CCD_PATH);
  console.log('  Size: ' + (xml.length / 1024).toFixed(1) + ' KB');
  console.log('='.repeat(70));

  // Parse all sections
  const labResults = parseLabResults();
  const vitals = parseVitalSigns();
  const problems = parseProblems();
  const meds = parseMedications();
  const encounters = parseEncounters();
  parseAllergies();

  // Import with deduplication
  await importLabResults(labResults);
  await importVitalsAsLabs(vitals);
  await importEncounters(encounters);
  await checkProblems(problems);
  await checkMedications(meds);

  // --- Final Summary ---
  console.log('\n' + '='.repeat(70));
  console.log('  IMPORT SUMMARY');
  console.log('='.repeat(70));

  console.log(`\nSections found: ${summary.sections_found.join(', ')}`);

  console.log(`\nLab Results:`);
  console.log(`  Found in CCD: ${summary.labs.found}`);
  console.log(`  New inserted:  ${summary.labs.new}`);
  console.log(`  Skipped (dup): ${summary.labs.skipped}`);

  console.log(`\nVital Signs:`);
  console.log(`  Found in CCD: ${summary.vitals.found}`);
  console.log(`  New inserted:  ${summary.vitals.new}`);
  console.log(`  Skipped (dup): ${summary.vitals.skipped}`);

  console.log(`\nEncounters:`);
  console.log(`  Found in CCD: ${summary.encounters.found}`);
  console.log(`  New timeline:  ${summary.encounters.new}`);
  console.log(`  Skipped (dup): ${summary.encounters.skipped}`);

  console.log(`\nProblems:`);
  console.log(`  Found in CCD: ${summary.problems.found}`);
  console.log(`  Already exist: ${summary.problems.skipped}`);
  console.log(`  New detected:  ${summary.problems.new}`);

  console.log(`\nMedications:`);
  console.log(`  Found in CCD: ${summary.medications.found}`);
  console.log(`  Already exist: ${summary.medications.skipped}`);
  console.log(`  New detected:  ${summary.medications.new}`);

  console.log(`\nAllergies: ${summary.allergies.details.join(', ') || 'None found'}`);

  if (summary.notable.length > 0) {
    console.log(`\nNotable findings:`);
    for (const n of summary.notable) {
      console.log(`  * ${n}`);
    }
  }

  // Check for clinically notable values in newly imported data
  const newLabs = summary.labs.details;
  const newVitals = summary.vitals.details;

  if (newLabs.length > 0 || newVitals.length > 0) {
    console.log('\nNew data imported:');
    for (const d of [...newLabs, ...newVitals]) {
      console.log(`  ${d}`);
    }
  }

  if (summary.encounters.details.length > 0) {
    console.log('\nNew timeline events:');
    for (const d of summary.encounters.details) {
      console.log(`  ${d}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  IMPORT COMPLETE');
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
