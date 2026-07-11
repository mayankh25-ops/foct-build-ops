// PDF report — live preview of the exported report + template toggles
// (admin-only) + real Download (jspdf) and Email (edge function) actions.
import React, { useState } from 'react';
import { Download, Mail } from 'lucide-react';
import { C, FONT, PDF_TEMPLATE_LABELS, SITE_NAME, SITE_ADDR, STATUSES } from '../constants';
import { mono, Toggle, PhotoTile } from '../ui.jsx';
import { useSupport } from '../store.jsx';
import { downloadTicketPdf, ticketPdfBase64 } from '../pdf';
import { remote, supaConfigured } from '../api';

const label9 = { ...mono, fontSize: 9, letterSpacing: '0.1em', color: C.faint };

export default function PdfReport({ id, role }) {
  const { tickets, enrich, pdfTemplate, savePdfTemplate, showToast, session } = useSupport();
  const [busy, setBusy] = useState(false);
  const isAdmin = role === 'admin';

  const raw = tickets.find((t) => t.id === id)
    || tickets.find((t) => ['completed', 'closed'].includes(t.status))
    || tickets[0];
  if (!raw) return <div style={{ padding: 40, color: C.grey }}>No tickets yet — create one first.</div>;
  const t = enrich(raw);
  const pf = pdfTemplate;

  const toggle = (key) => {
    if (!isAdmin) {
      showToast('Only admins can change the report template', 'warn');
      return;
    }
    savePdfTemplate({ ...pf, [key]: !pf[key] });
  };

  const doDownload = async () => {
    setBusy(true);
    try {
      const fileName = await downloadTicketPdf(t, pf, { remoteUrlFor: supaConfigured ? remote.photoUrl : null });
      showToast(`PDF downloaded — ${fileName}`);
    } catch (e) {
      showToast(`Could not build the PDF — ${e?.message || e}`, 'err');
    } finally {
      setBusy(false);
    }
  };

  const doEmail = async () => {
    setBusy(true);
    try {
      const { base64, fileName } = await ticketPdfBase64(t, pf, { remoteUrlFor: supaConfigured ? remote.photoUrl : null });
      if (session?.mode === 'live' && supaConfigured) {
        await remote.emailReport({
          ticketNo: t.ticketNo,
          summary: `${t.cat} — ${t.levelText} · ${t.area} (${t.stL})`,
          pdfBase64: base64,
          fileName,
        });
        showToast(`Report emailed to the building manager and ${(t.by || '').split(' ·')[0]}`);
      } else {
        showToast('Demo mode — connect Supabase to send real emails. PDF is ready to download.', 'warn');
      }
    } catch (e) {
      showToast(`Email failed — ${e?.message || e}. The PDF can still be downloaded.`, 'err');
    } finally {
      setBusy(false);
    }
  };

  const field = (l, v) => (
    <div>
      <div style={label9}>{l}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, marginTop: 3 }}>{v}</div>
    </div>
  );
  const stamp = (l, v) => (
    <div>
      <div style={label9}>{l}</div>
      <div style={{ ...mono, fontSize: 11.5, color: C.ink, marginTop: 3 }}>{v}</div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,660px) 320px', gap: 22, alignItems: 'start', animation: 'bstFade 0.3s ease-out' }}>
      {/* Paper preview */}
      <div style={{
        background: '#fff', border: `1px solid ${C.line}`, borderRadius: 4,
        boxShadow: '0 8px 28px rgba(14,15,17,0.1)', padding: '44px 48px', minHeight: 820,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <img src="/support/logo-dark.png" alt="Focused Facilities Management" style={{ height: 22, width: 'auto' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', color: C.faint }}>SUPPORT TICKET REPORT</div>
            <div style={{ ...mono, fontSize: 15, fontWeight: 600, color: C.ink, marginTop: 3 }}>{t.ticketNo}</div>
          </div>
        </div>
        <div style={{ height: 2, background: C.brand, margin: '20px 0 24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
          {pf.siteName && field('SITE', `${SITE_NAME} — ${SITE_ADDR}`)}
          {field('LEVEL / AREA', `${t.levelText} · ${t.area}`)}
          {pf.tags && field('ISSUE TYPE', `${t.cat} · ${t.prio} priority`)}
          {field('STATUS', (STATUSES[t.status] || STATUSES.open).l)}
        </div>
        <div style={{ height: 1, background: C.wash, margin: '20px 0' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          {stamp('CREATED', t.createdD)}
          {pf.assignedTime && stamp('ASSIGNED', t.assignedD)}
          {pf.attendedTime && stamp('ATTENDED', t.attendedD)}
          {pf.completedTime && stamp('COMPLETED', t.completedD)}
        </div>
        <div style={{ height: 1, background: C.wash, margin: '20px 0' }} />
        <div>
          <div style={{ ...label9, marginBottom: 6 }}>DESCRIPTION</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: C.body, margin: 0 }}>{t.desc}</p>
        </div>
        {pf.remarks && t.remarks && (
          <div style={{ marginTop: 18 }}>
            <div style={{ ...label9, marginBottom: 6 }}>
              REMARKS — COMPLETED BY {(t.team || 'CLEANING TEAM').toUpperCase()}
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: C.body, margin: 0 }}>{t.remarks}</p>
          </div>
        )}
        {pf.internalNotes && t.notes && (
          <div style={{ marginTop: 18 }}>
            <div style={{ ...label9, marginBottom: 6 }}>INTERNAL NOTES</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: C.body, margin: 0 }}>{t.notes}</p>
          </div>
        )}
        {pf.photos && (t.beforeTiles.length > 0 || t.afterTiles.length > 0) && (
          <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ ...label9, marginBottom: 8 }}>BEFORE</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {t.beforeTiles.map((ph) => (
                  <PhotoTile key={ph.id} photo={ph} kind="before" width={118} height={88} radius={6} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...label9, marginBottom: 8 }}>AFTER</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {t.afterTiles.map((ph) => (
                  <PhotoTile key={ph.id} photo={ph} kind="after" width={118} height={88} radius={6} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.wash}`, paddingTop: 12 }}>
            {pf.assignedUser ? (
              <span style={{ ...mono, fontSize: 10, letterSpacing: '0.08em', color: C.faint }}>
                ATTENDED BY — {(t.team || 'Unassigned').toUpperCase()}
              </span>
            ) : <span />}
            <span style={{ ...mono, fontSize: 10, letterSpacing: '0.08em', color: C.faint }}>
              FOCUSED FACILITIES MANAGEMENT · PAGE 1 OF 1
            </span>
          </div>
        </div>
      </div>

      {/* Template + actions rail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 92 }}>
        <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(14,15,17,0.04)' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.wash}` }}>
            <h3 style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15, color: C.ink, margin: 0 }}>Report template</h3>
            <p style={{ fontSize: 12.5, color: C.grey, margin: '4px 0 0' }}>
              {isAdmin ? 'Fields shown on every exported report.' : 'Read-only — the admin controls the template.'}
            </p>
          </div>
          <div style={{ padding: '8px 20px 14px', display: 'flex', flexDirection: 'column' }}>
            {Object.entries(PDF_TEMPLATE_LABELS).map(([key, l]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.bg}` }}>
                <span style={{ fontSize: 13.5, color: C.body }}>{l}</span>
                <Toggle on={pf[key]} disabled={!isAdmin} onClick={() => toggle(key)} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={doDownload} disabled={busy} style={{
            height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: C.brand, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14,
            fontWeight: 600, cursor: 'pointer', fontFamily: FONT, opacity: busy ? 0.7 : 1,
          }}>
            <Download size={16} strokeWidth={1.75} />
            Download PDF
          </button>
          <button onClick={doEmail} disabled={busy} style={{
            height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14,
            fontWeight: 600, color: C.ink, cursor: 'pointer', fontFamily: FONT, opacity: busy ? 0.7 : 1,
          }}>
            <Mail size={16} strokeWidth={1.75} />
            Email PDF
          </button>
          <p style={{ fontSize: 12, color: C.faint, lineHeight: 1.5, margin: '2px 0 0' }}>
            Emails go to the building manager and the ticket creator with the PDF attached.
          </p>
        </div>
      </div>
    </div>
  );
}
