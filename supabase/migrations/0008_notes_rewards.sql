-- Notes inbox: track which guest notes a manager has read
alter table guest_notes add column if not exists read_at timestamptz;
drop policy if exists notes_update on guest_notes;
create policy notes_update on guest_notes for update using (can_edit_location(location_id)) with check (can_edit_location(location_id));

-- Rewards: owners and managers can mark a reward as used at the register
drop policy if exists loyalty_update on loyalty_cards;
create policy loyalty_update on loyalty_cards for update using (can_edit_location(location_id)) with check (can_edit_location(location_id));
