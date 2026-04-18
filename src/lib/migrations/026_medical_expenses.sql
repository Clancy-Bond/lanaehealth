-- 026_medical_expenses.sql
-- Tracks medical expenses for FSA/HSA receipt generation.
-- Every recent Oura Trustpilot 1-star review is about missing itemized
-- receipts for reimbursement; LanaeHealth can generate them on demand.
--
-- Scope: this is FSA/HSA paperwork, not accounting. We capture what the
-- IRS needs for an eligible medical expense: date of service, provider
-- or vendor, description, amount, and category. Proof-of-payment (credit
-- card screenshot, etc.) is stored as a URL reference; not uploaded here.

CREATE TABLE IF NOT EXISTS medical_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- When the service was rendered or the item purchased (NOT when paid)
  service_date DATE NOT NULL,

  -- Who it was paid to (doctor, pharmacy, Oura, etc.)
  provider_or_vendor TEXT NOT NULL,

  -- What it was (short human description: "Telehealth visit - Dr. Kim",
  -- "Metformin 500mg 90-day refill", "Oura Ring membership annual")
  description TEXT NOT NULL,

  -- Amount in cents to avoid float drift. Always USD for MVP.
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),

  -- Category: one of the IRS Pub 502 buckets we support.
  -- See src/lib/types.ts -> MedicalExpenseCategory for the enum.
  category TEXT NOT NULL CHECK (category IN (
    'office_visit',           -- PCP, specialist, telehealth copay
    'prescription',           -- Rx medications
    'lab_imaging',            -- bloodwork, MRI, CT, ultrasound
    'device',                 -- Oura ring, wearables, monitors
    'subscription',           -- Natural Cycles, Bearable, MyNetDiary, Oura membership
    'supplement',             -- OTC only if FSA-eligible (LMN on file)
    'therapy',                -- mental health, PT, OT
    'dental_vision',          -- dental or vision expense
    'travel_medical',         -- mileage or travel for care
    'other'                   -- anything else with a Letter of Medical Necessity
  )),

  -- Optional fields
  letter_of_medical_necessity BOOLEAN DEFAULT FALSE,   -- needed for supplements/other
  receipt_url TEXT,                                    -- link to scanned receipt (Dropbox, etc.)
  notes TEXT,                                          -- freeform patient notes

  -- Link to existing tables where applicable
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

  -- FSA/HSA claim tracking
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  plan_year INTEGER,                                   -- 2026 etc; for multi-year receipts

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_expenses_service_date
  ON medical_expenses(service_date DESC);

CREATE INDEX IF NOT EXISTS idx_medical_expenses_plan_year
  ON medical_expenses(plan_year)
  WHERE plan_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_medical_expenses_unclaimed
  ON medical_expenses(claimed, service_date DESC)
  WHERE claimed = FALSE;

-- Keep updated_at fresh on any row change
CREATE OR REPLACE FUNCTION set_medical_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS medical_expenses_updated_at ON medical_expenses;
CREATE TRIGGER medical_expenses_updated_at
  BEFORE UPDATE ON medical_expenses
  FOR EACH ROW EXECUTE FUNCTION set_medical_expenses_updated_at();
