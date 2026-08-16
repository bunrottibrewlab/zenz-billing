-- =====================================================
-- ZenZ — Complement Items Migration
-- Run in Supabase SQL Editor
-- =====================================================

-- Mark which categories offer complement suggestions
ALTER TABLE categories ADD COLUMN IF NOT EXISTS complement_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Join table: product → complement products
CREATE TABLE IF NOT EXISTS product_complements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  complement_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE (product_id, complement_id)
);

CREATE INDEX IF NOT EXISTS idx_product_complements_product ON product_complements(product_id);
CREATE INDEX IF NOT EXISTS idx_product_complements_shop    ON product_complements(shop_id);

ALTER TABLE product_complements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON product_complements FOR ALL TO authenticated USING (TRUE);
