// Building Support Tickets — shared design tokens and domain constants.
// Values mirror the Claude Design handoff (Building Support Tickets.dc.html /
// Mobile App.dc.html) exactly so both UIs stay pixel-faithful.

export const FONT =
  "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const C = {
  ink: '#0E0F11',
  inkSoft: '#1E2329',
  body: '#333A42',
  slate: '#49515B',
  grey: '#6A737F',
  faint: '#98A1AC',
  hair: '#C2C9D1',
  line: '#DBE0E6',
  wash: '#EAEDF1',
  bg: '#F4F6F8',
  paper: '#FAFBFC',
  // Brand accent — Focused Facilities Management blue (from the FFM logo).
  brand: '#2568B2',
  brandDark: '#1D579A',
  brandDeep: '#16457E',
  brandWash: '#EAF1F9',
  brandLine: '#C3D7EE',
  steel: '#808184', // logo grey
  // Semantic error/urgent red — independent of the brand accent.
  err: '#DE192A',
  errDark: '#C4111F',
  errDeep: '#A30C18',
  errWash: '#FFF1F2',
  errLine: '#FFC4C8',
  green: '#1F8A5B',
  greenWash: '#E7F6EF',
  greenLine: '#D7EDE1',
  greenBg: '#F4FBF7',
  amber: '#C07A00',
  amberWash: '#FBF1DE',
  amberLine: '#EAD9B0',
  amberBg: '#FFFDF6',
  amberDeep: '#8A6100',
  blue: '#2563A8',
  blueWash: '#E8F0F9',
  orange: '#E05206',
};

// Ticket statuses — label + badge colours, straight from the design logic.
export const STATUSES = {
  open:       { l: 'Open',               bg: C.blueWash,  fg: C.blue },
  assigned:   { l: 'Assigned',           bg: C.wash,      fg: C.slate },
  inprogress: { l: 'In progress',        bg: C.amberWash, fg: C.amber },
  attended:   { l: 'Attended',           bg: C.blueWash,  fg: C.blue },
  completed:  { l: 'Completed',          bg: C.greenWash, fg: C.green },
  unable:     { l: 'Unable to complete', bg: C.errWash,   fg: C.errDark },
  awaiting:   { l: 'Awaiting invoice',   bg: C.amberWash, fg: C.amber },
  closed:     { l: 'Closed',             bg: C.wash,      fg: C.grey },
};

export const PRIORITIES = {
  Urgent: C.errDark,
  High: C.amber,
  Medium: C.slate,
  Low: C.faint,
};
// The mobile priority picker uses distinct accent fills per the design.
export const PRIORITY_ACCENT = {
  Low: { dot: C.green, active: C.green },
  Medium: { dot: C.amber, active: C.amber },
  High: { dot: C.orange, active: C.orange },
  Urgent: { dot: C.err, active: C.err },
};

export const DEFAULT_LEVELS = (() => {
  const lv = ['B2', 'B1', 'G', 'P'];
  for (let i = 1; i <= 86; i++) lv.push('L' + i);
  return lv;
})();

export const DEFAULT_CATEGORIES = [
  'Graffiti', 'Spill', 'Rubbish', 'Glass clean', 'Bio clean', 'Chute clean',
  'Pressure wash', 'Damage', 'Assistance', 'Adhoc work', 'Complaint',
  'Cleaning request', 'Resident report',
];

export const DEFAULT_AREAS = [
  'Lobby', 'Lift lobby', 'Corridor', 'Car park', 'Refuse room', 'Amenities',
  'Podium terrace', 'Loading dock',
];

export const TEAMS = [
  'Day shift — Cleaning',
  'Night shift — Cleaning',
  'Pressure & exterior',
  'Unassigned — triage later',
];

export const ROLES = {
  concierge: { label: 'Concierge' },
  cleaning: { label: 'Cleaning team' },
  admin: { label: 'Admin / facility manager' },
};

export function levelText(l) {
  return l === 'G' ? 'GROUND' : l === 'P' ? 'PODIUM' : (l || '');
}

// "04 JUL, 06:42" — the timestamp format used across the design.
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
export function fmtStamp(dateish) {
  const d = dateish ? new Date(dateish) : new Date();
  if (isNaN(d)) return String(dateish || '—');
  return (
    String(d.getDate()).padStart(2, '0') + ' ' + MONTHS[d.getMonth()] + ', ' +
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  );
}
export function fmtTime(dateish) {
  const d = new Date(dateish);
  if (isNaN(d)) return '—';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function badgeStyle(status) {
  const st = STATUSES[status] || STATUSES.open;
  return {
    display: 'inline-block', padding: '3px 10px', borderRadius: 999,
    fontSize: 11.5, fontWeight: 600, background: st.bg, color: st.fg,
    whiteSpace: 'nowrap',
  };
}

// PDF template defaults — which fields appear on exported reports.
export const DEFAULT_PDF_TEMPLATE = {
  siteName: true, tags: true, assignedTime: true, attendedTime: true,
  completedTime: true, assignedUser: true, remarks: true, photos: true,
  internalNotes: false,
};
export const PDF_TEMPLATE_LABELS = {
  siteName: 'Site name',
  tags: 'Category tags',
  assignedTime: 'Assigned time',
  attendedTime: 'Attended time',
  completedTime: 'Completed time',
  assignedUser: 'Assigned team / user',
  remarks: 'Remarks',
  photos: 'Before / after photos',
  internalNotes: 'Internal notes',
};

export const TICKET_PREFIX = 'AUR';
export const SITE_NAME = 'Auro Tower';
export const SITE_ADDR = '130 Rivera Esplanade';
