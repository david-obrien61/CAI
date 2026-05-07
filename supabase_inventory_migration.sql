-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: inventory
-- PURPOSE:   Parts inventory table for shop stock.
--            Replaces the hardcoded mock array in IgnitionStok.jsx.
--            Used by _source_parts() in shop_estimate.py to check stock
--            before routing to a preferred vendor.
--
-- NOTE: `tools` table = shop equipment (lifts, scanners, wrenches).
--       This table = consumable parts stock (filters, sensors, pads, etc.)
--
-- SAFE TO RE-RUN: all statements use IF NOT EXISTS / DROP ... IF EXISTS guards.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  part_number  text,
  name         text        NOT NULL,
  description  text,
  qty          integer     NOT NULL DEFAULT 0,
  bin_location text,
  unit_cost    numeric(10,2),
  brand        text,
  fits_codes   text[],     -- DTC / fault codes this part covers (e.g. ['P0171','P0174'])
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_shop_idx     ON inventory(shop_id);
CREATE INDEX IF NOT EXISTS inventory_partnum_idx  ON inventory(shop_id, part_number);
CREATE INDEX IF NOT EXISTS inventory_name_idx     ON inventory(shop_id, name);
CREATE INDEX IF NOT EXISTS inventory_qty_idx      ON inventory(shop_id, qty);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_inventory" ON inventory;
CREATE POLICY "pilot_all_inventory" ON inventory FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS inventory_updated_at ON inventory;
CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
