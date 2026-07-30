#!/usr/bin/env node
/**
 * Generates supabase/migrations/0012_org_isolation.sql.
 *
 * 0012 re-scopes a dozen SECURITY DEFINER functions from "attached to this
 * building" to "employed by my organisation". `create or replace` needs the
 * WHOLE body, and hand-copying a body is how a function quietly loses a rule it
 * used to enforce. So this script lifts each function verbatim from the
 * migration that shipped it and applies only the named patch — anything it
 * cannot find is a hard error, not a silent skip.
 *
 * Re-run after editing 0007/0009/0010/0011:  npm run build:0012
 */
import { readFileSync, writeFileSync } from "node:fs";

const HEADER = readFileSync("supabase/migrations/0012_org_isolation.head.sql", "utf8");
const OUT = "supabase/migrations/0012_org_isolation.sql";

const src = {
  "0007": readFileSync("supabase/migrations/0007_attendance_kiosk.sql", "utf8"),
  "0009": readFileSync("supabase/migrations/0009_kiosk_notices.sql", "utf8"),
  "0010": readFileSync("supabase/migrations/0010_timesheets.sql", "utf8"),
  "0011": readFileSync("supabase/migrations/0011_roster.sql", "utf8"),
};

/** Lift `create or replace function public.<name>` … through its final grant. */
function lift(file, name) {
  const text = src[file];
  const start = text.indexOf(`create or replace function public.${name}(`);
  if (start < 0) throw new Error(`${name}: not found in ${file}`);
  const tail = text.indexOf(`grant execute on function public.${name}(`, start);
  if (tail < 0) throw new Error(`${name}: no grant after it in ${file}`);
  const end = text.indexOf("\n", tail);
  return text.slice(start, end + 1);
}

/** Every patch must match exactly once. A miss means the source moved. */
function patch(body, name, edits) {
  for (const [from, to] of edits) {
    const hits = body.split(from).length - 1;
    if (hits !== 1) throw new Error(`${name}: pattern matched ${hits}× — ${from.slice(0, 60)}…`);
    body = body.replace(from, to);
  }
  return body;
}

const OWN = "app.in_org"; // reads: my organisation's people
const MINE = "     -- 0012: my organisation's employees only\n";

const FUNCTIONS = [
  {
    file: "0007",
    name: "attendance_sessions",
    why: "the admin session list",
    edits: [["   where p.kind = 'in';", `   where p.kind = 'in'\n${MINE}     and ${OWN}(s.org_id);`]],
  },
  {
    file: "0007",
    name: "kiosk_staff_search",
    why: "a tablet searches its own company's names",
    edits: [
      [
        "   where s.building_id = d.building_id and s.active",
        "   where s.building_id = d.building_id and s.active\n     -- 0012: this tablet belongs to ONE company\n     and s.org_id = d.org_id",
      ],
    ],
  },
  {
    file: "0009",
    name: "kiosk_bootstrap",
    why: "the offline cache must not hold another company's PIN hashes",
    edits: [
      [
        "   where s.building_id = d.building_id and s.active;",
        "   where s.building_id = d.building_id and s.active\n     -- 0012: never cache another company's staff or their PIN hashes\n     and s.org_id = d.org_id;",
      ],
      [
        "   where n.building_id = d.building_id and n.active and n.staff_id is null",
        "   where n.building_id = d.building_id and n.active and n.staff_id is null\n     and n.org_id = d.org_id   -- 0012",
      ],
    ],
  },
  {
    file: "0009",
    name: "kiosk_punch",
    why: "a PIN is only valid on its own company's tablet",
    edits: [
      [
        "   where building_id = d.building_id and pin = p_pin and active;",
        "   where building_id = d.building_id and pin = p_pin and active\n     and org_id = d.org_id;   -- 0012",
      ],
    ],
  },
  {
    file: "0009",
    name: "kiosk_sync",
    why: "an offline batch cannot punch somebody else's employee",
    edits: [
      [
        "                    where id = v_staff and building_id = d.building_id and active) then",
        "                    where id = v_staff and building_id = d.building_id and active\n                      and org_id = d.org_id) then   -- 0012",
      ],
    ],
  },
  {
    file: "0009",
    name: "notices_for_staff",
    why: "notices belong to the company that wrote them",
    edits: [
      [
        "                  where id = p_staff and building_id = d.building_id and active) then",
        "                  where id = p_staff and building_id = d.building_id and active\n                    and org_id = d.org_id) then   -- 0012",
      ],
      [
        "       where n.building_id = d.building_id\n",
        "       where n.building_id = d.building_id and n.org_id = d.org_id   -- 0012\n",
      ],
    ],
  },
  {
    file: "0009",
    name: "notice_ack",
    why: "acknowledging somebody else's notice is not a thing",
    edits: [
      [
        "   where n.id = p_notice and n.building_id = d.building_id",
        "   where n.id = p_notice and n.building_id = d.building_id and n.org_id = d.org_id",
      ],
    ],
  },
  {
    file: "0009",
    name: "staff_reset_pin",
    why: "issuing a PIN is the employer's business",
    edits: [
      [
        "  if not app.manages_staff_at(v_building) then raise exception 'not permitted'; end if;",
        "  -- 0012: the EMPLOYER, not merely a manager at this building\n  if not app.manages_staff(p_staff) then raise exception 'not permitted'; end if;",
      ],
    ],
  },
  {
    file: "0010",
    name: "timesheet_week",
    why: "payroll is the most private thing here",
    edits: [
      [
        "    where s.building_id = p_building\n",
        `    where s.building_id = p_building\n      and ${OWN}(s.org_id)   -- 0012: my organisation's employees only\n`,
      ],
    ],
  },
  {
    file: "0010",
    name: "attendance_adjust",
    why: "only the employer corrects hours",
    edits: [
      [
        "  if not app.manages_staff_at(e.building_id) then raise exception 'not permitted'; end if;",
        "  -- 0012: the employer of THIS person, not any manager at the building\n  if not app.manages_staff(e.staff_id) then raise exception 'not permitted'; end if;",
      ],
    ],
  },
  {
    file: "0010",
    name: "timesheet_decide",
    why: "one company cannot approve another's week",
    edits: [
      [
        "  if not exists (select 1 from public.staff where id = p_staff and building_id = p_building) then",
        "  -- 0012: `and app.in_org(org_id)` makes another company's employee read as\n  -- unknown rather than approvable\n  if not exists (select 1 from public.staff where id = p_staff and building_id = p_building\n                  and app.in_org(org_id)) then",
      ],
    ],
  },
  {
    file: "0011",
    name: "roster_week",
    why: "each company sees its own board at a shared site",
    edits: [
      [
        "   where r.building_id = p_building\n     and r.work_date between p_week_start and p_week_start + 6;",
        `   where r.building_id = p_building\n     and ${OWN}(s.org_id)   -- 0012\n     and r.work_date between p_week_start and p_week_start + 6;`,
      ],
      [
        "   where s.building_id = p_building and s.active;",
        `   where s.building_id = p_building and s.active and ${OWN}(s.org_id);   -- 0012`,
      ],
    ],
  },
  {
    file: "0011",
    name: "roster_shift_set",
    why: "you can only roster your own people, and only edit your own shifts",
    edits: [
      [
        "  if not exists (select 1 from public.staff\n                  where id = p_staff and building_id = p_building and active) then",
        `  -- 0012: \"does not work at this site\" now also covers \"works here, for\n  -- somebody else\"\n  if not exists (select 1 from public.staff\n                  where id = p_staff and building_id = p_building and active\n                    and ${OWN}(org_id)) then`,
      ],
      [
        "       where id = p_id and building_id = p_building\n",
        "       where id = p_id and building_id = p_building\n         and app.employs_staff(staff_id)   -- 0012: not somebody else's shift\n",
      ],
    ],
  },
  {
    file: "0011",
    name: "roster_shift_delete",
    why: "deleting another company's shift was possible at a shared site",
    edits: [
      [
        "declare v_building uuid;\nbegin\n  select building_id into v_building from public.roster_shifts where id = p_id;\n  if v_building is null then return jsonb_build_object('ok', true, 'already_gone', true); end if;\n  if not app.manages_staff_at(v_building) then raise exception 'not permitted'; end if;",
        "declare v_building uuid; v_staff uuid;\nbegin\n  select building_id, staff_id into v_building, v_staff\n    from public.roster_shifts where id = p_id;\n  if v_building is null then return jsonb_build_object('ok', true, 'already_gone', true); end if;\n  -- 0012: the employer of the person on the shift\n  if not app.manages_staff(v_staff) then raise exception 'not permitted'; end if;",
      ],
    ],
  },
  {
    file: "0011",
    name: "roster_copy_week",
    why: "copying a week must not copy another company's shifts",
    edits: [
      [
        "    select * from public.roster_shifts\n     where building_id = p_building\n       and work_date between p_from_week and p_from_week + 6\n     order by work_date, start_min",
        `    select rs.* from public.roster_shifts rs\n     join public.staff st on st.id = rs.staff_id\n     where rs.building_id = p_building\n       and ${OWN}(st.org_id)   -- 0012\n       and rs.work_date between p_from_week and p_from_week + 6\n     order by rs.work_date, rs.start_min`,
      ],
    ],
  },
];

let out = HEADER.trimEnd() + "\n";
for (const f of FUNCTIONS) {
  const body = patch(lift(f.file, f.name), f.name, f.edits);
  out += `\n-- ${"-".repeat(74)}\n`;
  out += `-- ${f.name} (${f.file}) — ${f.why}\n`;
  out += `-- ${"-".repeat(74)}\n`;
  out += body;
}
writeFileSync(OUT, out);
console.log(`${OUT}: ${out.split("\n").length} lines, ${FUNCTIONS.length} functions re-scoped`);
