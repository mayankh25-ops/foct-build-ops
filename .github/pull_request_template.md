## What changed

<!-- One paragraph: what this does and why. Link the DECISIONS.md entry if this
     changes an architectural choice. -->

## Impact

<!-- What else reads this code, table or RPC? Attendance feeds timesheets,
     dashboards, missed alerts and payroll export — say which of those move. -->

- Modules touched:
- Tables / RPCs touched:
- Older clients still compatible? (the kiosk tablet updates on refresh — a
  breaking RPC change strands it until then)

## Testing

<!-- Tick what you actually ran. CI runs the automated ones; the manual ones
     are you. Delete rows that genuinely don't apply and say why. -->

**Automated (CI)**

- [ ] `npm run verify` — tokens, contrast, types, lint, unit, secrets, deps, build
- [ ] `npm run test:db` — isolation suites, bundle applies and re-applies
- [ ] `npm run test:e2e` — routes, kiosk, service desk, phone
- [ ] New behaviour has a test; any bug fixed here has a test that fails without the fix

**Manual (see docs/TESTING.md)**

- [ ] Kiosk device matrix — *if the kiosk changed*
- [ ] Safari / iPhone — *if the UI changed*
- [ ] Staging UAT by the affected role
- [ ] Migration reviewed for destructive changes; rollback noted below

## Rollback

<!-- How do we undo this if it misbehaves in front of a client?
     Vercel redeploy? Feature flag? Is the migration reversible? -->

## Screenshots

<!-- Before / after for anything visual. -->
