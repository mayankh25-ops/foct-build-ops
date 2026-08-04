-- Shift handover (0016). Expect 14 ok notices.
--
-- A handover log is evidence: "the dock was closed, Amelia said so at 18:40 on
-- the 3rd". The assertions here are the ways it stops being evidence — history
-- that can be rewritten, a note attributed to the wrong person, a day boundary
-- taken from UTC instead of the building, or another company reading it.
do $$
declare
  v_building uuid; v_tz text; v_res jsonb; v_note uuid; v_n int;
  c_priya  constant uuid := '22222222-0000-0000-0000-000000000003'; -- FOCT Cleaning manager
  c_marcus constant uuid := '22222222-0000-0000-0000-000000000004'; -- FOCT Cleaning staff
  c_amelia constant uuid := '22222222-0000-0000-0000-000000000007'; -- Concierge Collective
begin
  select id, timezone into v_building, v_tz from public.buildings where slug = 'aurora-on-collins';
  delete from public.handover_notes where building_id = v_building;

  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_priya), true);

  -- 1. a note is written
  v_res := public.handover_add(v_building,
    'Loading dock closed until 06:30 — use the Little Collins entry.');
  v_note := (v_res ->> 'id')::uuid;
  if (v_res ->> 'ok')::boolean and v_note is not null then
    raise notice 'ok 1: a handover note is written';
  else raise exception 'FAIL 1: %', v_res; end if;

  -- 2. an empty note is refused rather than filling the log with blanks
  v_res := public.handover_add(v_building, '    ');
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 2: an empty note is refused';
  else raise exception 'FAIL 2: empty note accepted'; end if;

  -- 3. THE AUTHOR IS THE CALLER — you cannot post as somebody else
  if (select author_id from public.handover_notes where id = v_note) = c_priya then
    raise notice 'ok 3: the note is attributed to whoever wrote it';
  else raise exception 'FAIL 3: wrong author'; end if;

  -- 4. the feed returns it with a NAME and a TIME, not just an id
  v_res := public.handover_feed(v_building);
  if (v_res ->> 'ok')::boolean
     and exists (select 1 from jsonb_array_elements(v_res -> 'notes') n
                  where (n ->> 'id')::uuid = v_note
                    and n ->> 'author' = 'Priya Sharma'
                    and n ->> 'created_at' is not null) then
    raise notice 'ok 4: the timeline carries the author''s name and the time';
  else raise exception 'FAIL 4: %', v_res -> 'notes'; end if;

  -- 5. and the day it belongs to in the BUILDING's timezone
  if (select (n ->> 'work_date')::date from jsonb_array_elements(v_res -> 'notes') n
       where (n ->> 'id')::uuid = v_note) = (now() at time zone v_tz)::date then
    raise notice 'ok 5: a note is filed under the building''s day, not UTC''s';
  else raise exception 'FAIL 5: wrong work_date'; end if;

  -- 6. newest first — a handover is read from the top
  perform pg_sleep(0.05);
  perform public.handover_add(v_building, 'Scrubber battery on charge in BOH.');
  v_res := public.handover_feed(v_building);
  if (v_res -> 'notes' -> 0 ->> 'body') like 'Scrubber%' then
    raise notice 'ok 6: the newest note is at the top';
  else raise exception 'FAIL 6: wrong order'; end if;

  -- 7. an "important" note keeps its flag, for the supervisor scanning the day
  perform public.handover_add(v_building, 'Lift 3 out of service all week.', 'important');
  if exists (select 1 from jsonb_array_elements(public.handover_feed(v_building) -> 'notes') n
              where n ->> 'kind' = 'important') then
    raise notice 'ok 7: an important note is marked as one';
  else raise exception 'FAIL 7: kind lost'; end if;

  -- 8. HISTORY IS PAGED, so a year of notes is still readable
  v_res := public.handover_feed(v_building, null, 2);
  if jsonb_array_length(v_res -> 'notes') = 2 and (v_res ->> 'has_more')::boolean then
    raise notice 'ok 8: the timeline pages, and says when there is more';
  else raise exception 'FAIL 8: %', v_res; end if;

  -- 9. and the next page continues where the last one stopped
  declare v_cursor timestamptz;
  begin
    v_cursor := (v_res -> 'notes' -> 1 ->> 'created_at')::timestamptz;
    v_res := public.handover_feed(v_building, v_cursor, 2);
    if jsonb_array_length(v_res -> 'notes') >= 1
       and not exists (select 1 from jsonb_array_elements(v_res -> 'notes') n
                        where (n ->> 'created_at')::timestamptz >= v_cursor) then
      raise notice 'ok 9: paging back through history never repeats a note';
    else raise exception 'FAIL 9: %', v_res -> 'notes'; end if;
  end;

  -- ------------------------------------------------- append-only ------------
  -- 10. NOBODY CAN EDIT HISTORY. There is no update path, and the table
  --     refuses one even to a manager acting directly.
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_priya), true);
  execute 'set local role authenticated';
  begin
    update public.handover_notes set body = 'rewritten' where id = v_note;
    if (select body from public.handover_notes where id = v_note) = 'rewritten' then
      raise exception 'FAIL 10: a handover note was edited';
    end if;
    raise notice 'ok 10: a handover note cannot be edited — the log is append-only';
  exception when insufficient_privilege then
    raise notice 'ok 10: a handover note cannot be edited — the log is append-only';
  end;
  execute 'reset role';

  -- 11. the author may withdraw a fresh mistake
  v_res := public.handover_delete(v_note);
  if (v_res ->> 'ok')::boolean
     and (select deleted_at is not null from public.handover_notes where id = v_note) then
    raise notice 'ok 11: the author can withdraw a note they just posted';
  else raise exception 'FAIL 11: %', v_res; end if;

  -- 12. and it leaves a TOMBSTONE rather than a hole in the record
  v_res := public.handover_feed(v_building);
  if exists (select 1 from jsonb_array_elements(v_res -> 'notes') n
              where (n ->> 'id')::uuid = v_note
                and (n ->> 'deleted')::boolean and n ->> 'body' = '') then
    raise notice 'ok 12: a withdrawn note leaves a visible tombstone, not a gap';
  else raise exception 'FAIL 12: the note vanished'; end if;

  -- 13. an OLD note cannot be withdrawn — corrections are new notes
  declare v_old uuid;
  begin
    v_old := (public.handover_add(v_building, 'Yesterday''s note.') ->> 'id')::uuid;
    update public.handover_notes set created_at = now() - interval '2 hours' where id = v_old;
    v_res := public.handover_delete(v_old);
    if not (v_res ->> 'ok')::boolean
       and (select deleted_at is null from public.handover_notes where id = v_old) then
      raise notice 'ok 13: once it is history, it stands — add a correction instead';
    else raise exception 'FAIL 13: %', v_res; end if;
  end;

  -- ------------------------------------------------- isolation --------------
  -- 14. THE CONCIERGE COMPANY HAS ITS OWN LOG. Same building, same table,
  --     different readers — they never see the cleaning company's handover.
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_amelia), true);
  perform public.handover_add(v_building, 'Parcel room key handed to night concierge.');
  v_res := public.handover_feed(v_building);
  select count(*) into v_n from jsonb_array_elements(v_res -> 'notes');
  if v_n = 1 and (v_res -> 'notes' -> 0 ->> 'body') like 'Parcel room%' then
    raise notice 'ok 14: each company sees its OWN handover, never the other''s';
  else raise exception 'FAIL 14: concierge saw % notes', v_n; end if;
end $$;
