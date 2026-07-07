-- pgTAP isolation test for 0001_theme_engine.sql — runs at Stage 2 with the
-- platform test harness (two seeded orgs: FOCT Cleaning = org_a, a second
-- unrelated org = org_b; helper to impersonate a member of each).
begin;
select plan(6);

-- seed: one custom theme per org (as org members)
select tests.authenticate_as('member_org_a');
insert into public.themes (org_id, name, slug, base_theme, tokens)
values (tests.org_a(), 'Aurora Custom', 'aurora-custom', 'option-nature', '{"accent":"#657a59"}');

select tests.authenticate_as('member_org_b');
insert into public.themes (org_id, name, slug, base_theme, tokens)
values (tests.org_b(), 'Rival Custom', 'rival-custom', 'graphite', '{"accent":"#101828"}');

-- 1–2: each org sees its own custom theme
select tests.authenticate_as('member_org_a');
select is(
  (select count(*)::int from public.themes where slug = 'aurora-custom'), 1,
  'org A sees its own custom theme');
select is(
  (select count(*)::int from public.themes where slug = 'rival-custom'), 0,
  'org A cannot see org B''s custom theme');

-- 3: built-ins visible to everyone
select ok(
  (select count(*) from public.themes where is_builtin) > 0,
  'built-in themes are visible across orgs');

-- 4: org A cannot modify org B's theme (0 rows affected under RLS)
update public.themes set name = 'hijacked' where slug = 'rival-custom';
select is(
  (select count(*)::int from public.themes where name = 'hijacked'), 0,
  'org A cannot update org B''s theme');

-- 5: org A cannot create a theme in org B's name
select throws_ok(
  format('insert into public.themes (org_id, name, slug) values (%L, ''x'', ''x-slug'')', tests.org_b()),
  '42501', null,
  'org A cannot insert a theme owned by org B');

-- 6: built-ins are immutable through the API role
select throws_ok(
  'update public.themes set name = ''nope'' where is_builtin limit 1',
  null, null,
  'built-in themes cannot be modified by org members');

select * from finish();
rollback;
