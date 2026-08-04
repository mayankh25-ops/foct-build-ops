-- =============================================================================
-- FOCT BuildingOps — SHIFT HANDOVER (paste into the Supabase SQL editor and
-- Run). Idempotent — safe to re-run.
--
-- Turns the handover note from a list of the last five entries into a log you
-- can go back through: every note kept, with WHO wrote it and WHEN, grouped by
-- the building's own day and paged backwards through history.
--
-- Append-only on purpose — a shift log that can be quietly rewritten is worth
-- nothing in a dispute. The author can withdraw a note for 15 minutes (it
-- leaves a visible tombstone); after that, a correction is a new note.
--
-- Each organisation sees only its own handover: the concierge company's log and
-- the cleaning company's log live in the same table at the same building and
-- never cross.
--
-- Afterwards run supabase/tests/handover_check.sql (expect 14 ok).
-- =============================================================================

-- =============================================================================
-- 0016 — Shift handover: a log you can go back through.
--
-- The handover note was a demo list of the five most recent entries with a
-- relative time ("3h ago") and nothing behind it. What a handover actually
-- needs is the opposite: every entry kept, with WHO wrote it and WHEN, so the
-- next shift — or somebody asking three weeks later why the dock was closed —
-- can read the history rather than the headline.
--
-- Design decisions, each one a way the log could stop being trustworthy:
--
--   * APPEND-ONLY. A note cannot be edited. A shift log that can be quietly
--     rewritten is worth nothing in a dispute; corrections are new notes, and
--     they sit in the timeline next to what they correct.
--   * A short DELETE window (15 minutes, author only) for the "wrong site,
--     wrong window" mistake — after that it stands, and a deleted note leaves
--     a tombstone rather than vanishing.
--   * ORG-PRIVATE (0012's rule). The concierge company's handover is theirs;
--     the cleaning company's is theirs. Same table, same building, different
--     readers — which is exactly the isolation model the product is sold on.
--   * The AUTHOR IS THE CALLER. You cannot post as somebody else.
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- WHICH of my organisations is this note for?
--
-- `app.managing_org_for()` answers a different question — "who MANAGES staff
-- here" — and falls back to the building's owner for anyone without a manager
-- role. Used here it filed a concierge's note under the strata company, and the
-- concierge then could not read their own note back. This asks the right
-- question: the caller's own organisation that services this building.
create or replace function app.my_org_at(check_building uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.org_id
       from public.organisation_memberships m
      where m.user_id = auth.uid() and m.active
        and app.org_serves_building(m.org_id, check_building)
      order by m.org_id
      limit 1),
    app.managing_org_for(check_building))
$$;
revoke all on function app.my_org_at(uuid) from public;
grant execute on function app.my_org_at(uuid) to authenticated;

create table if not exists public.handover_notes (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  org_id      uuid not null references public.organisations(id) on delete cascade,
  author_id   uuid not null references public.users(id),
  body        text not null check (length(trim(body)) between 1 and 4000),
  /** info | important — an "important" note is what a supervisor scans for */
  kind        text not null default 'info' check (kind in ('info','important')),
  -- clock_timestamp(), NOT now(): now() is the TRANSACTION's time, so two
  -- notes written in one transaction share a timestamp and the feed's order
  -- becomes a coin toss. A log wants wall-clock.
  created_at  timestamptz not null default clock_timestamp(),
  deleted_at  timestamptz,
  deleted_by  uuid references public.users(id)
);
create index if not exists handover_feed_idx
  on public.handover_notes (building_id, org_id, created_at desc, id desc);

alter table public.handover_notes enable row level security;
do $$ begin
  drop policy if exists handover_read on public.handover_notes;
  create policy handover_read on public.handover_notes for select to authenticated
    using (app.in_org(org_id));
  -- No UPDATE policy on purpose: the only write path is the RPC below, and it
  -- inserts. Append-only is enforced here, not asked for politely.
  drop policy if exists handover_write on public.handover_notes;
  create policy handover_write on public.handover_notes for insert to authenticated
    with check (app.in_org(org_id) and author_id = auth.uid());
end $$;


-- ------------------------------------------------------------------ write ---
create or replace function public.handover_add(
  p_building uuid, p_body text, p_kind text default 'info'
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_org uuid; v_id uuid;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  v_org := app.my_org_at(p_building);
  if v_org is null then raise exception 'no organisation for this building'; end if;
  if coalesce(trim(p_body), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Write something the next shift needs to know.');
  end if;
  if length(trim(p_body)) > 4000 then
    return jsonb_build_object('ok', false, 'error', 'That note is too long — keep it to a screenful.');
  end if;

  -- the author is the caller, always
  insert into public.handover_notes (building_id, org_id, author_id, body, kind)
  values (p_building, v_org, auth.uid(), trim(p_body),
          case when p_kind = 'important' then 'important' else 'info' end)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.handover_add(uuid, text, text) from public;
grant execute on function public.handover_add(uuid, text, text) to authenticated;


-- A mis-posted note can be withdrawn by its author for 15 minutes. It leaves a
-- tombstone: the timeline shows that something was removed and by whom, because
-- a gap nobody can account for is worse than a withdrawn line.
create or replace function public.handover_delete(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare n public.handover_notes;
begin
  select * into n from public.handover_notes where id = p_id;
  if n.id is null then return jsonb_build_object('ok', true, 'already_gone', true); end if;
  if n.author_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Only the person who wrote a note can withdraw it.');
  end if;
  if n.created_at < now() - interval '15 minutes' then
    return jsonb_build_object('ok', false,
      'error', 'That note is older than 15 minutes. Add a correction instead — the log is a record.');
  end if;
  update public.handover_notes
     set deleted_at = now(), deleted_by = auth.uid() where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.handover_delete(uuid) from public;
grant execute on function public.handover_delete(uuid) to authenticated;


-- ------------------------------------------------------------------- read ---
-- A page at a time, newest first, with the author's name resolved and the
-- building's own date attached so the screen can group by day without
-- re-deriving the timezone (and getting it wrong).
create or replace function public.handover_feed(
  p_building uuid, p_before timestamptz default null, p_limit int default 30
) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_tz text; v_rows jsonb; v_n int; v_limit int;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  select timezone into v_tz from public.buildings where id = p_building;
  if v_tz is null then raise exception 'building not found'; end if;
  v_limit := greatest(1, least(coalesce(p_limit, 30), 100));

  -- id breaks a tie, so a page never reshuffles between loads
  select coalesce(jsonb_agg(x order by (x ->> 'created_at') desc, (x ->> 'id') desc), '[]'::jsonb),
         count(*)
    into v_rows, v_n
    from (
      select jsonb_build_object(
               'id', n.id,
               'body', case when n.deleted_at is null then n.body else '' end,
               'kind', n.kind,
               'created_at', n.created_at,
               -- the DAY in the building's timezone: a 23:40 note in Melbourne
               -- belongs to that day, not to UTC's tomorrow
               'work_date', (n.created_at at time zone v_tz)::date,
               'author_id', n.author_id,
               'author', coalesce(u.name, split_part(coalesce(u.email, ''), '@', 1), 'Someone'),
               'deleted', n.deleted_at is not null,
               'deleted_at', n.deleted_at,
               'mine', n.author_id = auth.uid(),
               -- the screen offers "withdraw" only while the server would allow it
               'can_delete', n.author_id = auth.uid() and n.deleted_at is null
                             and n.created_at >= now() - interval '15 minutes'
             ) as x
        from public.handover_notes n
        left join public.users u on u.id = n.author_id
       where n.building_id = p_building
         and app.in_org(n.org_id)
         and (p_before is null or n.created_at < p_before)
       order by n.created_at desc, n.id desc
       limit v_limit
    ) s;

  return jsonb_build_object('ok', true, 'timezone', v_tz, 'notes', v_rows,
    -- "there is more history" — so the screen knows whether to offer it
    'has_more', v_n = v_limit);
end $$;
revoke all on function public.handover_feed(uuid, timestamptz, int) from public;
grant execute on function public.handover_feed(uuid, timestamptz, int) to authenticated;
