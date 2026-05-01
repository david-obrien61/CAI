-- ─────────────────────────────────────────────────────────────────────────────
-- IGNITION OS — Pilot RLS Policies
-- Run in: Supabase Dashboard → SQL Editor → New Query
--
-- These are open policies for the pilot phase (no Supabase Auth yet).
-- When Supabase Auth is wired, replace with: using (shop_id = auth.uid())
-- ─────────────────────────────────────────────────────────────────────────────

create policy "pilot_all" on shops           for all using (true) with check (true);
create policy "pilot_all" on users           for all using (true) with check (true);
create policy "pilot_all" on jobs            for all using (true) with check (true);
create policy "pilot_all" on purchase_orders for all using (true) with check (true);
create policy "pilot_all" on tools           for all using (true) with check (true);
create policy "pilot_all" on pmi_schedules   for all using (true) with check (true);
create policy "pilot_all" on ai_usage        for all using (true) with check (true);
