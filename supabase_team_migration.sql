-- =====================================================
-- ZenZ — Team / Staff Management Migration
-- Run this in Supabase SQL Editor
-- =====================================================

-- Staff members per shop
CREATE TABLE IF NOT EXISTS shop_staff (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  role           TEXT NOT NULL DEFAULT 'staff'
                   CHECK (role IN ('admin', 'manager', 'staff')),
  salary_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  salary_type    TEXT NOT NULL DEFAULT 'monthly'
                   CHECK (salary_type IN ('monthly', 'weekly', 'daily')),
  joined_date    DATE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_staff_shop_id ON shop_staff(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_staff_role    ON shop_staff(shop_id, role);

-- Salary payment records
CREATE TABLE IF NOT EXISTS salary_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES shop_staff(id) ON DELETE CASCADE,
  amount          NUMERIC(10, 2) NOT NULL,
  period_label    TEXT NOT NULL,          -- e.g. "August 2026"
  payment_method  TEXT NOT NULL DEFAULT 'cash'
                    CHECK (payment_method IN ('cash', 'bank', 'upi')),
  notes           TEXT,
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_shop_id  ON salary_payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_staff_id ON salary_payments(staff_id);

-- Leave requests
CREATE TABLE IF NOT EXISTS staff_leaves (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id    UUID NOT NULL REFERENCES shop_staff(id) ON DELETE CASCADE,
  leave_type  TEXT NOT NULL DEFAULT 'casual'
                CHECK (leave_type IN ('casual', 'sick', 'emergency', 'unpaid')),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_leaves_shop_id  ON staff_leaves(shop_id);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_staff_id ON staff_leaves(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_status   ON staff_leaves(status);

-- RLS: all tables owned/managed by service role only
-- (API routes use createAdminClient which bypasses RLS)
ALTER TABLE shop_staff     ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leaves    ENABLE ROW LEVEL SECURITY;
