-- =============================================================================
-- 0012 — THE ISOLATION FIX. Staff records belong to their employer, not to the
-- building.
--
-- WHAT WAS WRONG
-- 0007–0011 gated every staff-related READ on `app.can_access_building()` —
-- "are you attached to this building". At a real tower that is the concierge
-- company, the strata manager, an electrical subcontractor and every other
-- cleaning company on site. With Supabase's default table grants, all of them
-- could read, through the REST API:
--
--     select name, pin from staff;          -- including the plaintext kiosk PIN
--     select * from attendance_events;      -- when each cleaner came and went
--     select * from roster_shifts;          -- the cleaning roster
--     select * from timesheet_weeks;        -- what each person is paid
--
-- Reproduced on the mirror: the concierge, the strata admin AND the electrician
-- each read a cleaner's row and their 4-digit PIN — a PIN is a credential, so
-- that is not only a privacy breach, it is enough to sign somebody else in.
--
-- (It was invisible locally because a plain Postgres grants nothing to
-- `authenticated`, while Supabase grants everything and leaves RLS as the only
-- guard. `_mirror_bootstrap.sql` now copies those grants, so this class of hole
-- fails in CI from here on.)
--
-- WHAT THIS DOES
--   1. `app.in_org()` / `app.employs_staff()` / `app.manages_staff()` — one
--      definition of "this is my company's employee".
--   2. Every staff-related read policy is re-scoped from the BUILDING to the
--      EMPLOYING ORGANISATION. Attachment to a building no longer grants
--      anything about another company's people.
--   3. The secrets lose their column privileges outright: `staff.pin` and
--      `kiosk_devices.device_token` can no longer be selected by any API role,
--      whatever the policies say. Definer functions still read them.
--   4. Write paths gain the same employer test, so one cleaning company cannot
--      edit another's roster, corrections or PINs at a shared site.
--   5. The kiosk is scoped to its own organisation: a tablet no longer caches
--      another company's staff or their PIN hashes.
--
-- What the other orgs keep: the building owner and the concierge still get
-- cleaning PROGRESS through `attendance_day()`'s summary (0013) — counts, not
-- names. That is the CLAUDE.md rule ("completion status only when granted"),
-- expressed where it cannot be bypassed.
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------- helpers ----

-- Is the caller a member of THIS organisation? Super admins pass everywhere.
create or replace function app.in_org(check_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.is_super_admin() or exists (
    select 1 from public.organisation_memberships m
     where m.user_id = auth.uid() and m.active and m.org_id = check_org
  )
$$;
revoke all on function app.in_org(uuid) from public;
grant execute on function app.in_org(uuid) to authenticated;

-- Does the caller's organisation EMPLOY this person?
create or replace function app.employs_staff(check_staff uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
     where s.id = check_staff and app.in_org(s.org_id)
  )
$$;
revoke all on function app.employs_staff(uuid) from public;
grant execute on function app.employs_staff(uuid) to authenticated;

-- May the caller CHANGE this person's record? Their employer, and a manager.
create or replace function app.manages_staff(check_staff uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
     where s.id = check_staff
       and app.in_org(s.org_id)
       and app.manages_staff_at(s.building_id)
  )
$$;
revoke all on function app.manages_staff(uuid) from public;
grant execute on function app.manages_staff(uuid) to authenticated;


-- ------------------------------------------------------- read policies -------
-- Each of these replaces a building-scoped read with an employer-scoped one.
do $$ begin
  -- staff: your company's people, at any building you service
  drop policy if exists staff_read on public.staff;
  create policy staff_read on public.staff for select to authenticated
    using (app.in_org(org_id));
  drop policy if exists staff_write on public.staff;
  create policy staff_write on public.staff for all to authenticated
    using (app.in_org(org_id) and app.manages_staff_at(building_id))
    with check (app.in_org(org_id) and app.manages_staff_at(building_id));

  -- kiosk devices: a pair code is a credential; only the owning org sees it
  drop policy if exists kiosk_read on public.kiosk_devices;
  create policy kiosk_read on public.kiosk_devices for select to authenticated
    using (app.in_org(org_id));
  drop policy if exists kiosk_write on public.kiosk_devices;
  create policy kiosk_write on public.kiosk_devices for all to authenticated
    using (app.in_org(org_id) and app.manages_staff_at(building_id))
    with check (app.in_org(org_id) and app.manages_staff_at(building_id));

  -- the roster is an employer's internal document
  drop policy if exists shifts_read on public.roster_shifts;
  create policy shifts_read on public.roster_shifts for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists shifts_write on public.roster_shifts;
  create policy shifts_write on public.roster_shifts for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));

  -- when each person came and went
  drop policy if exists events_read on public.attendance_events;
  create policy events_read on public.attendance_events for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists events_write on public.attendance_events;
  create policy events_write on public.attendance_events for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));

  -- corrections and pay decisions
  drop policy if exists adjustments_read on public.attendance_adjustments;
  create policy adjustments_read on public.attendance_adjustments for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists adjustments_write on public.attendance_adjustments;
  create policy adjustments_write on public.attendance_adjustments for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));

  drop policy if exists timesheet_read on public.timesheet_weeks;
  create policy timesheet_read on public.timesheet_weeks for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists timesheet_write on public.timesheet_weeks;
  create policy timesheet_write on public.timesheet_weeks for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));

  -- notices are written by one company for its own people
  drop policy if exists notices_read on public.notices;
  create policy notices_read on public.notices for select to authenticated
    using (app.in_org(org_id));
  drop policy if exists notices_write on public.notices;
  create policy notices_write on public.notices for all to authenticated
    using (app.in_org(org_id) and app.manages_staff_at(building_id))
    with check (app.in_org(org_id) and app.manages_staff_at(building_id));

  drop policy if exists notice_acks_read on public.notice_acks;
  create policy notice_acks_read on public.notice_acks for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists notice_acks_write on public.notice_acks;
  create policy notice_acks_write on public.notice_acks for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));
end $$;


-- --------------------------------------------------- the secret columns ------
-- Belt and braces, and the guard that survives a future policy mistake: the
-- credentials are not selectable by any API role at all.
--
-- NOTE ON HOW THIS HAS TO BE WRITTEN: `revoke select (pin)` alone does nothing
-- while table-level SELECT is granted — Postgres treats the table grant as
-- covering every column, present and future. So the table grant is withdrawn
-- and SELECT is re-granted column by column. (Proven the wrong way round first:
-- the column revoke passed silently and the PIN was still readable.)
--
-- CONSEQUENCE, worth knowing before adding a column: a new column on `staff` or
-- `kiosk_devices` is NOT readable by the app until it is added to the list
-- below. That is the safe direction to fail in.
revoke select on public.staff         from anon, authenticated;
revoke select on public.kiosk_devices from anon, authenticated;

-- `pin` (the credential itself) and `pin_hash` (offline verification, handed to
-- a paired tablet by kiosk_bootstrap) are deliberately absent.
grant select (id, org_id, building_id, name, role, active, created_at,
              preferred_language)
  on public.staff to authenticated;

-- `device_token` is deliberately absent: it is issued to the tablet by
-- kiosk_pair and never shown again. UPDATE is untouched, so "unpair this
-- tablet" can still clear it from the admin screen.
grant select (id, building_id, org_id, label, pair_code, pair_expires,
              paired_at, last_seen, active, created_at)
  on public.kiosk_devices to authenticated;


-- ============================================== definer reads, re-scoped =====
-- These functions run as the owner, so RLS does not apply inside them and the
-- scoping has to be written out. Each keeps its building check (an unrelated
-- company still gets "not permitted") and now returns, or accepts, only the
-- caller's OWN employees.
--
-- EVERYTHING BELOW THIS LINE IS GENERATED by scripts/build-0012-org-isolation.mjs:
-- each function is lifted verbatim from the migration that shipped it and given
-- one named patch, so a body can never silently drift from what is running.
-- Regenerate with `npm run build:0012`; do not hand-edit past this point.
