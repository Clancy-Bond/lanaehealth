/**
 * Parse and import Adventist Health ED Visit CCD/CCDA XMLs
 *
 * Reads:
 *   /Users/clancybond/Downloads/LANAE BOND_health-summary-04072026.xml (Apr 7 ED visit)
 *   /Users/clancybond/Downloads/LANAE BOND_health-summary-04092026.xml (Apr 9 ED visit)
 *
 * Sections parsed: Encounter (ED details, diagnoses, providers), Lab Results,
 *   Vital Signs, Reason for Visit, Hospital Discharge Instructions, Procedures
 * Smart dedup: compares against existing Supabase data before inserting
 *
 * Usage: cd /Users/clancybond/lanaehealth && node src/lib/migrations/parse-ed-ccd-import.mjs
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

// --- ED CCD files ---
const ED_FILES = [
  {
    path: '/Users/clancybond/Downloads/LANAE BOND_health-summary-04072026.xml',
    label: 'Apr 7 ED Visit',
    expectedDate: '2026-04-07',
  },
  {
    path: '/Users/clancybond/Downloads/LANAE BOND_health-summary-04092026.xml',
    label: 'Apr 9 ED Visit',
    expectedDate: '2026-04-09',
  },
];

// --- Summary counters ---
const summary = {
  files_processed: 0,
  labs: { found: 0, new: 0, skipped: 0, details: [] },
  vitals: { found: 0, new: 0, skipped: 0, details: [] },
  encounters: { found: 0, new: 0, skipped: 0, details: [] },
  notable: [],
};

// =============================================
// UTILITY FUNCTIONS (same as original parser)
// =============================================

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '');
}

function cleanValue(raw) {
  let cleaned = raw.replace(/\*HI\*|\*LO\*/g, '').trim();
  cleaned = cleaned.replace(/\s+\d+(?:,\s*\d+)*\s*$/, '').trim();
  cleaned = cleaned.replace(/([a-zA-Z/%])(\d+(?:,\s*\d+)*)$/, '$1').trim();
  return cleaned;
}

function parseNumericValue(raw) {
  const cleaned = cleanValue(raw);
  const match = cleaned.match(/^[<>]?\s*([\d.]+)/);
  if (match) return parseFloat(match[1]);
  if (/negative/i.test(cleaned)) return 0;
  return null;
}

function parseUnit(raw) {
  const cleaned = cleanValue(raw);
  const match = cleaned.match(/^[<>]?\s*[\d.]+\s*(.+)$/);
  if (match) return match[1].trim();
  return '';
}

function parseRefRange(ref) {
  if (!ref) return { low: null, high: null };
  const decoded = decodeEntities(ref);
  let m = decoded.match(/Normal is\s+([\d.]+)\s*-\s*([\d.]+)/);
  if (m) return { low: parseFloat(m[1]), high: parseFloat(m[2]) };
  m = decoded.match(/Normal is\s*[<≤]=?\s*([\d.]+)/);
  if (m) return { low: null, high: parseFloat(m[1]) };
  m = decoded.match(/Normal is\s*[>≥]=?\s*([\d.]+)/);
  if (m) return { low: parseFloat(m[1]), high: null };
  m = decoded.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (m) return { low: parseFloat(m[1]), high: parseFloat(m[2]) };
  return { low: null, high: null };
}

function computeFlag(value, refLow, refHigh) {
  if (value == null) return 'normal';
  if (refLow != null && value < refLow) return 'low';
  if (refHigh != null && value > refHigh) return 'high';
  return 'normal';
}

function shortDateToISO(s) {
  const parts = s.split('/');
  if (parts.length !== 3) return null;
  let [month, day, year] = parts.map(Number);
  if (year < 100) year += 2000;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

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
  if (/crp|esr|sed rate|complement|c1 esterase|ige|immunoglob|tryptase/i.test(n)) return 'Immunology';
  if (/troponin|bnp|pro-bnp/i.test(n)) return 'Cardiac';
  if (/lactate|lactic/i.test(n)) return 'Chemistry';
  return 'Other';
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
    'WBC': ['WBC'], 'RBC': ['RBC'], 'MCV': ['MCV'], 'MCH': ['MCH'],
    'MCHC': ['MCHC'], 'RDW': ['RDW'], 'MPV': ['MPV'],
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
    'ALT': ['ALT'], 'AST': ['AST'],
    'Bilirubin, Total': ['Bilirubin Total', 'Total Bilirubin', 'Bilirubin, Total'],
    'Total Protein': ['Total Protein', 'Protein, Total'],
    'Globulin Level': ['Globulin', 'Globulin Level'],
    'BHCG/Pregnancy, Serum QUAL': ['BHCG/Pregnancy', 'BHCG/Pregnancy, Serum QUAL', 'Pregnancy Test'],
    'Retic, pct': ['Reticulocyte %', 'Retic, pct', 'Reticulocyte Count'],
    'eGFR': ['eGFR', 'GFR'],
    'MAP Non-Invasive': ['MAP', 'Mean Arterial Pressure'],
    'Peripheral Pulse Rate': ['Pulse Rate', 'Peripheral Pulse Rate', 'Heart Rate'],
    'Heart Rate Monitored': ['Heart Rate', 'Heart Rate Monitored'],
    'Supine pulse rate': ['Supine Pulse Rate', 'Supine Heart Rate'],
  };
  return map[name] || [];
}

// =============================================
// SECTION PARSERS (adapted for ED CCDs)
// =============================================

function findSection(xml, title) {
  const titleIdx = xml.indexOf(`<title>${title}</title>`);
  if (titleIdx === -1) return null;
  return titleIdx;
}

function parseLabResults(xml) {
  const startIdx = findSection(xml, 'Results');
  if (startIdx == null) return [];

  const nextTitle = xml.indexOf('<title>', startIdx + 100);
  const section = xml.substring(startIdx, nextTitle > 0 ? nextTitle : startIdx + 300000);
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

  return results;
}

function parseVitalSigns(xml) {
  const startIdx = findSection(xml, 'Vital Signs');
  if (startIdx == null) return [];

  const nextTitle = xml.indexOf('<title>', startIdx + 100);
  const section = xml.substring(startIdx, nextTitle > 0 ? nextTitle : startIdx + 100000);
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

    // Non-BP vitals
    const vitalPattern = /<content ID="VSEVN\d+">([^<]+)<\/content><\/td><td[^>]*>(.*?)<\/td><td>(.*?)<\/td>/gs;
    for (const match of dateSection.matchAll(vitalPattern)) {
      const name = match[1].trim();
      const valCell = decodeEntities(stripTags(match[2]).trim());
      const refCell = decodeEntities(stripTags(match[3]).trim());

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

    // Blood Pressure
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

  return vitals;
}

function parseEDEncounter(xml) {
  // ED CCDs use <title>Encounter</title> (singular, not "Encounter(s)")
  const startIdx = findSection(xml, 'Encounter');
  if (startIdx == null) return null;

  const nextTitle = xml.indexOf('<title>', startIdx + 50);
  const section = xml.substring(startIdx, nextTitle > 0 ? nextTitle : startIdx + 10000);

  // Extract from paragraph
  const paraMatch = section.match(/<paragraph ID="ENCOUNTER\d+">(.*?)<\/paragraph>/s);
  if (!paraMatch) return null;

  const paraContent = paraMatch[1];

  // Date
  const dateMatch = paraContent.match(/Date\(s\):\s*(\d+\/\d+\/\d+)/);
  const isoDate = dateMatch ? shortDateToISO(dateMatch[1]) : null;

  // Facility
  const facilityMatch = paraContent.match(/Adventist Health [^<]+/);
  const facility = facilityMatch ? facilityMatch[0].replace(/<br\/?>/g, '').trim() : 'Adventist Health Castle';

  // Attending Physician
  const attendingMatch = paraContent.match(/Attending Physician:\s*([^<]+)/);
  let attending = attendingMatch ? attendingMatch[1].trim() : null;
  // Clean up format: "Conklin, MD, Ryan C" -> "Dr. Ryan C Conklin"
  if (attending) {
    const parts = attending.split(',').map(s => s.trim());
    if (parts.length >= 3) {
      const lastName = parts[0];
      const suffix = parts[1]; // MD or DO
      const firstName = parts.slice(2).join(' ');
      attending = `Dr. ${firstName} ${lastName}, ${suffix}`;
    } else if (parts.length === 2) {
      attending = `Dr. ${parts[1]} ${parts[0]}`;
    }
  }

  // NPI
  const npiMatch = section.match(/extension="(\d+)" assigningAuthorityName="National Provider Identifier"/);
  const npi = npiMatch ? npiMatch[1] : null;

  // Encounter type
  const typeMatch = paraContent.match(/Encounter Type:\s*([^<]+)/);
  const encType = typeMatch ? typeMatch[1].trim() : 'Emergency';

  // Discharge Disposition
  const dispMatch = paraContent.match(/Discharge Disposition:\s*([^<]+)/);
  const disposition = dispMatch ? dispMatch[1].trim() : null;

  // Encounter diagnoses
  const diagPattern = /<content ID="ENCDIAG\d+">([^<]+)<\/content>/g;
  const diagnoses = [];
  const diagSet = new Set();
  for (const dm of paraContent.matchAll(diagPattern)) {
    const diag = dm[1].trim();
    if (!diagSet.has(diag.toLowerCase())) {
      diagSet.add(diag.toLowerCase());
      diagnoses.push(diag);
    }
  }

  // ICD-10 codes from structured entries
  const icdPattern = /<value[^>]*code="([^"]+)"[^>]*codeSystem="2\.16\.840\.1\.113883\.6\.90"[^>]*displayName="([^"]+)"/g;
  const icdCodes = [];
  for (const m of section.matchAll(icdPattern)) {
    icdCodes.push({ code: m[1], display: m[2] });
  }

  // Encounter timing
  const timePattern = /<effectiveTime><low value="(\d+)"/;
  const timeMatch = section.match(timePattern);
  const highPattern = /<high value="(\d+)"/;
  const highMatch = section.match(highPattern);

  // Reason for visit
  const rfvIdx = findSection(xml, 'Reason for Visit');
  let reasonForVisit = null;
  if (rfvIdx != null) {
    const rfvEnd = xml.indexOf('<title>', rfvIdx + 50);
    const rfvSection = xml.substring(rfvIdx, rfvEnd > 0 ? rfvEnd : rfvIdx + 1000);
    const rfvMatch = rfvSection.match(/<content[^>]*>([^<]+)<\/content>/);
    if (rfvMatch) reasonForVisit = rfvMatch[1].trim();
  }

  return {
    date: isoDate,
    facility,
    attending,
    npi,
    type: encType,
    disposition,
    diagnoses,
    icdCodes,
    reasonForVisit,
    arrivalTime: timeMatch ? timeMatch[1] : null,
    departureTime: highMatch ? highMatch[1] : null,
  };
}

// =============================================
// DEDUP AND IMPORT
// =============================================

async function importLabResults(allLabs) {
  if (allLabs.length === 0) return;

  console.log(`\n=== Importing Lab Results (${allLabs.length} found across ED visits) ===\n`);

  const dates = [...new Set(allLabs.map(l => l.date))];
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
  for (const lab of allLabs) {
    const key = `${lab.date}|${lab.test_name.toLowerCase()}`;
    const altNames = getAltLabNames(lab.test_name);
    const anyExists = existingByKey.has(key) || altNames.some(alt => {
      return existingByKey.has(`${lab.date}|${alt.toLowerCase()}`);
    });

    if (anyExists) {
      summary.labs.skipped++;
      continue;
    }

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

  // Deduplicate within batch
  const seen = new Set();
  const deduped = [];
  for (const lab of toInsert) {
    const key = `${lab.date}|${lab.test_name}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(lab);
    }
  }

  if (deduped.length > 0) {
    console.log(`  Inserting ${deduped.length} new lab results...`);
    for (const lab of deduped) {
      console.log(`    [${lab.date}] ${lab.test_name}: ${lab.value} ${lab.unit || ''} (${lab.flag})`);
      summary.labs.details.push(`[NEW] ${lab.date} ${lab.test_name}: ${lab.value} ${lab.unit || ''}`);
    }

    const { error } = await supabase.from('lab_results').insert(deduped);
    if (error) {
      console.error('  ERROR inserting labs:', error.message);
    } else {
      summary.labs.new = deduped.length;
      console.log(`  Successfully inserted ${deduped.length} labs.`);
    }
  } else {
    console.log('  All lab results already exist in database. Nothing to insert.');
  }
}

async function importVitalsAsLabs(allVitals) {
  if (allVitals.length === 0) return;

  console.log(`\n=== Importing ED Vital Signs (${allVitals.length} found) ===\n`);

  const meaningful = allVitals.filter(v => {
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

  // Deduplicate within batch (take first occurrence for same date+name)
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

async function importEDEncounters(encounters) {
  if (encounters.length === 0) return;

  console.log(`\n=== Importing ED Encounter Timeline Events (${encounters.length}) ===\n`);

  const { data: existingTimeline } = await supabase
    .from('medical_timeline')
    .select('event_date, title, event_type');

  const toInsert = [];
  for (const enc of encounters) {
    if (!enc.date) continue;

    // Check if an ED visit for this date already exists
    const dateExists = (existingTimeline || []).some(t =>
      t.event_date === enc.date && (
        t.title.toLowerCase().includes('emergency') ||
        t.title.toLowerCase().includes('ed visit') ||
        t.event_type === 'hospitalization'
      )
    );

    if (dateExists) {
      console.log(`  SKIP (exists): [${enc.date}] ED visit`);
      summary.encounters.skipped++;
      continue;
    }

    const chiefComplaint = enc.reasonForVisit || enc.diagnoses[0] || 'ED Visit';
    const title = `ED visit at AH Castle - ${chiefComplaint}`;

    const description = [
      `Chief complaint: ${enc.reasonForVisit || 'Not recorded'}`,
      `Attending: ${enc.attending || 'Unknown'}`,
      enc.npi ? `NPI: ${enc.npi}` : null,
      `Diagnoses: ${enc.diagnoses.join('; ')}`,
      enc.icdCodes.length > 0
        ? `ICD-10: ${enc.icdCodes.map(c => `${c.code} (${c.display})`).join('; ')}`
        : null,
      `Disposition: ${enc.disposition || 'Home'}`,
      `Facility: ${enc.facility}`,
    ].filter(Boolean).join('. ');

    toInsert.push({
      event_date: enc.date,
      event_type: 'hospitalization',
      title,
      description,
      significance: 'important',
      linked_data: {
        source: 'ED CCD import',
        facility: enc.facility,
        encounter_type: 'Emergency',
        attending: enc.attending,
        npi: enc.npi,
        chief_complaint: enc.reasonForVisit,
        diagnoses: enc.diagnoses,
        icd_codes: enc.icdCodes,
        disposition: enc.disposition,
        arrival_time: enc.arrivalTime,
        departure_time: enc.departureTime,
      },
    });
  }

  if (toInsert.length > 0) {
    console.log(`  Inserting ${toInsert.length} new ED encounter timeline events...`);
    for (const e of toInsert) {
      console.log(`    [${e.event_date}] ${e.title}`);
      summary.encounters.details.push(`[NEW] ${e.event_date} ${e.title}`);
    }

    const { error } = await supabase.from('medical_timeline').insert(toInsert);
    if (error) {
      console.error('  ERROR inserting ED encounters:', error.message);
    } else {
      summary.encounters.new = toInsert.length;
      console.log(`  Successfully inserted ${toInsert.length} ED encounter events.`);
    }
  } else {
    console.log('  All ED encounters already represented in timeline. Nothing to insert.');
  }
}

// =============================================
// MAIN
// =============================================

async function main() {
  console.log('='.repeat(70));
  console.log('  ADVENTIST HEALTH ED VISIT CCD IMPORT');
  console.log('  Files: ' + ED_FILES.length + ' ED visit CCDs');
  console.log('='.repeat(70));

  const allLabs = [];
  const allVitals = [];
  const allEncounters = [];

  for (const file of ED_FILES) {
    console.log(`\n--- Processing: ${file.label} ---`);
    console.log(`    File: ${file.path}`);

    let xml;
    try {
      xml = readFileSync(file.path, 'utf-8');
      console.log(`    Size: ${(xml.length / 1024).toFixed(1)} KB`);
    } catch (err) {
      console.error(`    ERROR reading file: ${err.message}`);
      continue;
    }

    summary.files_processed++;

    // Parse encounter details
    const encounter = parseEDEncounter(xml);
    if (encounter) {
      console.log(`    Encounter: ${encounter.type} on ${encounter.date}`);
      console.log(`    Chief complaint: ${encounter.reasonForVisit || 'N/A'}`);
      console.log(`    Attending: ${encounter.attending || 'Unknown'}`);
      console.log(`    Diagnoses: ${encounter.diagnoses.join(', ')}`);
      console.log(`    Disposition: ${encounter.disposition || 'N/A'}`);
      allEncounters.push(encounter);
      summary.encounters.found++;
    }

    // Parse labs
    const labs = parseLabResults(xml);
    console.log(`    Lab results found: ${labs.length}`);
    allLabs.push(...labs);
    summary.labs.found += labs.length;

    // Parse vitals
    const vitals = parseVitalSigns(xml);
    console.log(`    Vital signs found: ${vitals.length}`);
    allVitals.push(...vitals);
    summary.vitals.found += vitals.length;
  }

  // Import with dedup
  await importLabResults(allLabs);
  await importVitalsAsLabs(allVitals);
  await importEDEncounters(allEncounters);

  // --- Final Summary ---
  console.log('\n' + '='.repeat(70));
  console.log('  ED CCD IMPORT SUMMARY');
  console.log('='.repeat(70));

  console.log(`\nFiles processed: ${summary.files_processed} / ${ED_FILES.length}`);

  console.log(`\nLab Results:`);
  console.log(`  Found in CCDs: ${summary.labs.found}`);
  console.log(`  New inserted:  ${summary.labs.new}`);
  console.log(`  Skipped (dup): ${summary.labs.skipped}`);

  console.log(`\nVital Signs:`);
  console.log(`  Found in CCDs: ${summary.vitals.found}`);
  console.log(`  New inserted:  ${summary.vitals.new}`);
  console.log(`  Skipped (dup): ${summary.vitals.skipped}`);

  console.log(`\nED Encounters:`);
  console.log(`  Found in CCDs: ${summary.encounters.found}`);
  console.log(`  New timeline:  ${summary.encounters.new}`);
  console.log(`  Skipped (dup): ${summary.encounters.skipped}`);

  if (summary.labs.details.length > 0 || summary.vitals.details.length > 0) {
    console.log('\nNew data imported:');
    for (const d of [...summary.labs.details, ...summary.vitals.details]) {
      console.log(`  ${d}`);
    }
  }

  if (summary.encounters.details.length > 0) {
    console.log('\nNew timeline events:');
    for (const d of summary.encounters.details) {
      console.log(`  ${d}`);
    }
  }

  // Flag clinically notable ED values
  const notables = [];
  for (const lab of allLabs) {
    if (lab.flag === 'high' || lab.flag === 'low') {
      notables.push(`${lab.date} ${lab.test_name}: ${lab.raw_value} [${lab.flag.toUpperCase()}]`);
    }
  }
  for (const v of allVitals) {
    if (v.value != null && v.reference_range_high != null && v.value > v.reference_range_high) {
      notables.push(`${v.date} ${v.vital_name}: ${v.raw_value} [HIGH]`);
    }
    if (v.value != null && v.reference_range_low != null && v.value < v.reference_range_low) {
      notables.push(`${v.date} ${v.vital_name}: ${v.raw_value} [LOW]`);
    }
  }
  if (notables.length > 0) {
    console.log('\nClinically notable values from ED visits:');
    for (const n of notables) {
      console.log(`  * ${n}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  ED CCD IMPORT COMPLETE');
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
