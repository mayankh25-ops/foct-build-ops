-- =============================================================================
-- 0008 — Storage bucket for kiosk sign-in/out selfies.
--
-- The 3-2-1 selfie is proof of attendance, so it has to survive the tablet. It
-- lands in a PRIVATE bucket at  <building_id>/<staff_id>/<uuid>.jpg  and the
-- path is recorded on the attendance event.
--
-- Trade-off, stated plainly: the kiosk is not a logged-in user, so the bucket
-- must accept an INSERT from the `anon` role. That is the only thing anon may
-- do — it cannot list, read, overwrite or delete anything, the bucket is
-- capped at 2 MB per object and restricted to JPEG/PNG/WebP. Reading a selfie
-- requires a signed URL issued to an authenticated member of that building.
--
-- Guarded so it is a no-op on a plain Postgres mirror (no `storage` schema).
-- Idempotent — safe to re-run.
-- =============================================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice '0008: no storage schema (local mirror) — skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('kiosk-selfies', 'kiosk-selfies', false, 2097152,
          array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
    set public = false,
        file_size_limit = 2097152,
        allowed_mime_types = array['image/jpeg','image/png','image/webp'];

  -- write-only for the kiosk
  if not exists (select 1 from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'kiosk_selfie_insert') then
    execute $p$
      create policy kiosk_selfie_insert on storage.objects for insert to anon, authenticated
        with check (bucket_id = 'kiosk-selfies')
    $p$;
  end if;

  -- readable only by someone who may see that building's data
  if not exists (select 1 from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'kiosk_selfie_read') then
    execute $p$
      create policy kiosk_selfie_read on storage.objects for select to authenticated
        using (bucket_id = 'kiosk-selfies'
               and app.can_access_building(
                     nullif(substring((storage.foldername(name))[1]
                                      from '^[0-9a-fA-F-]{36}$'), '')::uuid))
    $p$;
  end if;
end $$;
