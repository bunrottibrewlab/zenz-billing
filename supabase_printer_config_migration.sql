-- =====================================================
-- ZenZ — Thermal Printer Config Migration
-- Run in Supabase SQL Editor
-- Adds direct Wi-Fi/ESC-POS printer settings to
-- the bill_settings table (one config per shop).
-- =====================================================

-- Add thermal printer columns to bill_settings
ALTER TABLE bill_settings
  ADD COLUMN IF NOT EXISTS printer_enabled   BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS printer_ip        TEXT,
  ADD COLUMN IF NOT EXISTS printer_port      INTEGER   DEFAULT 9100,
  ADD COLUMN IF NOT EXISTS auto_cut          BOOLEAN   DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS full_cut          BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paper_width       TEXT      DEFAULT '80mm'
    CHECK (paper_width IN ('80mm', '58mm'));

-- Index for quick lookup (already exists via shop_id unique constraint,
-- but add a comment for clarity)
COMMENT ON COLUMN bill_settings.printer_enabled IS
  'When true, Print Bill uses direct TCP/ESC-POS printing instead of browser dialog';
COMMENT ON COLUMN bill_settings.printer_ip IS
  'IP address of the thermal printer on the local Wi-Fi network (e.g. 192.168.1.100)';
COMMENT ON COLUMN bill_settings.printer_port IS
  'RAW printing port — default 9100 for most ESC/POS thermal printers';
COMMENT ON COLUMN bill_settings.auto_cut IS
  'Send a partial paper-cut command after each receipt';
COMMENT ON COLUMN bill_settings.full_cut IS
  'Use full cut instead of partial cut (set false for printers without full-cut blade)';
COMMENT ON COLUMN bill_settings.paper_width IS
  'Thermal paper roll width: 80mm (standard 3-inch) or 58mm (narrow 2-inch)';
