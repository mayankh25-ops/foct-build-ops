// Phone insights — the concierge's pocket view of the same analytics the
// admin console shows: status mix donut, categories, busiest levels.
import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { C, FONT } from '../constants';
import { mono, SyncPill } from '../ui.jsx';
import { useAnalytics, StatusDonut, HBars, levelText } from '../charts.jsx';

const screenPad = { paddingLeft: 20, paddingRight: 20 };
const kicker = { ...mono, fontSize: 10, letterSpacing: '0.1em', color: C.faint, marginBottom: 10 };

function Tile({ label, v, sub, color = C.ink }) {
  return (
    <div style={{ border: `1px solid ${C.wash}`, borderRadius: 12, padding: '13px 14px' }}>
      <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.08em', color: C.grey }}>{label}</div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color, marginTop: 6 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: C.faint, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

export default function MInsights({ go }) {
  const { mix, total, tags, levels, openN, progN, doneN, urgentN } = useAnalytics();

  return (
    <div style={{ ...screenPad, paddingTop: 18, paddingBottom: 34, display: 'flex', flexDirection: 'column', flex: 1, gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 0' }}>
        <span onClick={() => go('home')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, color: C.brand, fontWeight: 600, cursor: 'pointer' }}>
          <ChevronLeft size={16} strokeWidth={2} />
          Home
        </span>
        <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 16, color: C.ink }}>Insights</span>
        <SyncPill compact />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Tile label="OPEN" v={openN} sub="across Auro Tower" />
        <Tile label="IN PROGRESS" v={progN} sub="teams on site" />
        <Tile label="COMPLETED" v={doneN} sub="incl. closed" />
        <Tile label="URGENT OPEN" v={urgentN} sub="need attention" color={urgentN ? C.errDark : C.ink} />
      </div>

      <div>
        <div style={kicker}>STATUS MIX</div>
        <div style={{ border: `1px solid ${C.wash}`, borderRadius: 14, padding: '16px 16px' }}>
          <StatusDonut mix={mix} total={total} size={116} />
        </div>
      </div>

      <div>
        <div style={kicker}>TICKETS BY CATEGORY</div>
        <div style={{ border: `1px solid ${C.wash}`, borderRadius: 14, padding: '14px 16px' }}>
          <HBars data={tags.slice(0, 6)} labelWidth={104} />
        </div>
      </div>

      <div>
        <div style={kicker}>BUSIEST LEVELS</div>
        <div style={{ border: `1px solid ${C.wash}`, borderRadius: 14, padding: '14px 16px' }}>
          <HBars data={levels.slice(0, 5).map(([lv, n]) => [levelText(lv).slice(0, 6), n])}
            labelWidth={64} accentFirst={false} />
        </div>
      </div>

      <div style={{ textAlign: 'center', ...mono, fontSize: 9.5, letterSpacing: '0.08em', color: C.faint }}>
        LIVE FROM THIS DEVICE — UPDATES AS TICKETS SYNC
      </div>
    </div>
  );
}
