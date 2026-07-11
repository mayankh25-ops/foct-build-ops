-- ============================================================================
-- Building Support Tickets — schema, RLS and storage.
-- Powers the offline-first support app (mobile + desktop) under /Support.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- support_profiles — support-app roles, separate from the marketing site's
-- profiles table so its role check ('admin'|'user') stays untouched.
-- ---------------------------------------------------------------------------
create table if not exists public.support_profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'concierge'
             check (role in ('concierge', 'cleaning', 'admin')),
  team       text,
  status     text not null default 'active' check (status in ('active', 'invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger support_profiles_set_updated_at
  before update on public.support_profiles
  for each row execute function public.set_updated_at();

-- SECURITY DEFINER helpers so policies don't recurse into support_profiles.
create or replace function public.support_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.support_profiles where id = auth.uid();
$$;

create or replace function public.is_support_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.support_profiles where id = auth.uid());
$$;

create or replace function public.is_support_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.support_role() = 'admin', false);
$$;

-- ---------------------------------------------------------------------------
-- Companies & sites — each site carries its own levels, areas and issues.
-- ---------------------------------------------------------------------------
create table if not exists public.support_companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.support_sites (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.support_companies (id) on delete cascade,
  name       text not null,
  address    text,
  ticket_prefix text not null default 'AUR',
  levels     jsonb not null default '[]',
  areas      jsonb not null default '[]',
  issues     jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tickets — the id is the CLIENT-generated uuid so offline creates replay
-- idempotently (upsert on id). ticket_no is assigned locally and kept unless
-- it collides, in which case the trigger bumps it to the next free number.
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id               uuid primary key,
  ticket_no        text not null,
  site_id          uuid references public.support_sites (id) on delete set null,
  level            text not null,
  area             text not null default 'Common area',
  category         text not null,
  priority         text not null default 'Medium'
                   check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  status           text not null default 'open'
                   check (status in ('open','assigned','inprogress','attended',
                                     'completed','unable','awaiting','closed')),
  description      text not null default '',
  created_by       uuid references auth.users (id) on delete set null,
  created_by_label text not null default '',
  team             text,
  assigned_at      timestamptz,
  attended_at      timestamptz,
  completed_at     timestamptz,
  remarks          text,
  chargeable       boolean not null default false,
  invoice_no       text,
  internal_notes   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists support_tickets_ticket_no_key
  on public.support_tickets (ticket_no);
create index if not exists support_tickets_status_idx
  on public.support_tickets (status);
create index if not exists support_tickets_created_idx
  on public.support_tickets (created_at desc);

create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- Two phones can allocate the same offline number (e.g. both pick AUR-1044
-- with no reception). Keep the first, renumber the second — never fail sync.
create or replace function public.support_assign_ticket_no()
returns trigger
language plpgsql
as $$
declare
  prefix text;
  next_n integer;
begin
  if new.ticket_no is null or exists (
    select 1 from public.support_tickets where ticket_no = new.ticket_no and id <> new.id
  ) then
    prefix := coalesce(nullif(split_part(coalesce(new.ticket_no, 'AUR-0'), '-', 1), ''), 'AUR');
    select coalesce(max((split_part(ticket_no, '-', 2))::integer), 1042) + 1
      into next_n
      from public.support_tickets
      where ticket_no like prefix || '-%'
        and split_part(ticket_no, '-', 2) ~ '^[0-9]+$';
    new.ticket_no := prefix || '-' || next_n;
  end if;
  return new;
end;
$$;

create trigger support_tickets_assign_no
  before insert on public.support_tickets
  for each row execute function public.support_assign_ticket_no();

-- ---------------------------------------------------------------------------
-- Photos — metadata rows; binaries live in the ticket-photos storage bucket.
-- ---------------------------------------------------------------------------
create table if not exists public.support_ticket_photos (
  id           uuid primary key,
  ticket_id    uuid not null references public.support_tickets (id) on delete cascade,
  kind         text not null default 'before' check (kind in ('before', 'after')),
  file_name    text not null default 'photo.jpg',
  storage_path text not null,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists support_ticket_photos_ticket_idx
  on public.support_ticket_photos (ticket_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — every support member can read; writes are role-gated.
-- ---------------------------------------------------------------------------
alter table public.support_profiles      enable row level security;
alter table public.support_companies     enable row level security;
alter table public.support_sites         enable row level security;
alter table public.support_tickets       enable row level security;
alter table public.support_ticket_photos enable row level security;

-- support_profiles
create policy "support_profiles: members read all"
  on public.support_profiles for select
  using (public.is_support_member());
create policy "support_profiles: owner updates self"
  on public.support_profiles for update
  using (id = auth.uid() or public.is_support_admin());
create policy "support_profiles: admin inserts"
  on public.support_profiles for insert
  with check (public.is_support_admin() or id = auth.uid());
create policy "support_profiles: admin deletes"
  on public.support_profiles for delete
  using (public.is_support_admin());

-- companies / sites: members read, admins write
create policy "support_companies: members read"
  on public.support_companies for select using (public.is_support_member());
create policy "support_companies: admin write"
  on public.support_companies for all
  using (public.is_support_admin()) with check (public.is_support_admin());

create policy "support_sites: members read"
  on public.support_sites for select using (public.is_support_member());
create policy "support_sites: admin write"
  on public.support_sites for all
  using (public.is_support_admin()) with check (public.is_support_admin());

-- tickets: members read; concierge/admin create; any member updates
-- (field statuses come from cleaners, billing/closing from admins — column
-- discipline is enforced app-side, destructive ops stay admin-only).
create policy "support_tickets: members read"
  on public.support_tickets for select using (public.is_support_member());
create policy "support_tickets: members create"
  on public.support_tickets for insert
  with check (public.is_support_member() and created_by = auth.uid());
create policy "support_tickets: members update"
  on public.support_tickets for update using (public.is_support_member());
create policy "support_tickets: admin delete"
  on public.support_tickets for delete using (public.is_support_admin());

-- photos
create policy "support_ticket_photos: members read"
  on public.support_ticket_photos for select using (public.is_support_member());
create policy "support_ticket_photos: members insert"
  on public.support_ticket_photos for insert with check (public.is_support_member());
create policy "support_ticket_photos: admin delete"
  on public.support_ticket_photos for delete
  using (public.is_support_admin() or created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage bucket for ticket photos. Public read keeps report/PDF rendering
-- simple; paths are unguessable uuids. Flip public->false and switch the app
-- to signed URLs if photos ever become sensitive.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ticket-photos', 'ticket-photos', true)
on conflict (id) do nothing;

create policy "ticket-photos: members upload"
  on storage.objects for insert
  with check (bucket_id = 'ticket-photos' and public.is_support_member());
create policy "ticket-photos: public read"
  on storage.objects for select
  using (bucket_id = 'ticket-photos');
create policy "ticket-photos: members update"
  on storage.objects for update
  using (bucket_id = 'ticket-photos' and public.is_support_member());

-- ---------------------------------------------------------------------------
-- Seed — default company/site so the app has levels/areas/issues on day one.
-- ---------------------------------------------------------------------------
do $$
declare
  co_id uuid;
begin
  if not exists (select 1 from public.support_companies) then
    insert into public.support_companies (name) values ('Auro Group') returning id into co_id;
    insert into public.support_sites (company_id, name, address, ticket_prefix, levels, areas, issues)
    values (
      co_id, 'Auro Tower', '130 Rivera Esplanade', 'AUR',
      '["B2","B1","G","P","L1–L86"]',
      '["Lobby","Lift lobby","Corridor","Car park","Amenities","Refuse room","Loading dock"]',
      '["Graffiti","Spill","Rubbish","Glass clean","Bio clean","Chute clean","Pressure wash","Damage","Assistance","Adhoc work","Complaint"]'
    );
  end if;
end
$$;

-- Anyone signing up while the app is brand new becomes a concierge profile
-- automatically; admins promote from Settings → Users.
create or replace function public.handle_new_support_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_support on auth.users;
create trigger on_auth_user_created_support
  after insert on auth.users
  for each row execute function public.handle_new_support_user();
