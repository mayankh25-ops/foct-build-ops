// Ticket PDF report — client-side via jspdf so it works fully offline.
// Layout mirrors the "PDF report preview" screen in the design handoff:
// logo + report label, red rule, site/where/issue/status grid, timestamps,
// description, remarks, before/after photos, footer. The admin-controlled
// template (pdfTemplate) decides which sections appear.
import { jsPDF } from 'jspdf';
import { idb } from './db';
import { fmtStamp, levelText, STATUSES, SITE_NAME, SITE_ADDR } from './constants';

const M = 48; // page margin (pt)
const INK = [14, 15, 17];
const GREY = [106, 115, 127];
const FAINT = [152, 161, 172];
const BODY = [51, 58, 66];
const BRAND = [37, 104, 178]; // FFM logo blue
const LINE = [234, 237, 241];

let logoCache = null;
async function loadLogo() {
  if (logoCache !== null) return logoCache;
  try {
    const res = await fetch('/support/logo-dark.png');
    const blob = await res.blob();
    logoCache = await blobToDataUrl(blob);
  } catch {
    logoCache = false; // fall back to text wordmark
  }
  return logoCache;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Re-encode any local photo blob to a bounded JPEG so jspdf always accepts it
// and file sizes stay sane on 12-megapixel phone photos.
async function photoToJpeg(blob, maxDim = 900) {
  try {
    const url = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
}

async function collectPhotos(ticketId, kind, remoteUrlFor) {
  const all = await idb.photosByTicket(ticketId);
  const rows = all.filter((p) => p.kind === kind).slice(0, 4);
  const out = [];
  for (const p of rows) {
    let blob = p.blob;
    if (!blob && p.storagePath && remoteUrlFor) {
      try {
        const res = await fetch(remoteUrlFor(p.storagePath));
        if (res.ok) blob = await res.blob();
      } catch { /* offline — skip remote photos */ }
    }
    if (!blob) continue;
    const jpeg = await photoToJpeg(blob);
    if (jpeg) out.push({ ...jpeg, name: p.name });
  }
  return out;
}

function label(doc, text, x, y) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...FAINT);
  doc.text(String(text).toUpperCase(), x, y, { charSpace: 0.8 });
}
function value(doc, text, x, y, size = 10.5) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.setTextColor(...INK);
  doc.text(String(text), x, y);
}
function rule(doc, y, w, color = LINE, h = 1) {
  doc.setFillColor(...color);
  doc.rect(M, y, w, h, 'F');
}

/**
 * Build the report. Returns { doc, fileName }.
 * @param ticket   enriched ticket (from store.enrich)
 * @param template pdf template toggles
 * @param opts     { remoteUrlFor } optional resolver for uploaded photos
 */
export async function buildTicketPdf(ticket, template, opts = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - M * 2;
  let y = 52;

  // Header
  const logo = await loadLogo();
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const h = 20;
      doc.addImage(logo, 'PNG', M, y - 12, (props.width / props.height) * h, h);
    } catch { /* fall through to wordmark */ }
  }
  if (!logo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text('FOCUSED FM', M, y);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(ticket.ticketNo || '', pageW - M, y + 6, { align: 'right' });
  // right-align the label too
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...FAINT);
  doc.text('SUPPORT TICKET REPORT', pageW - M, y - 8, { align: 'right', charSpace: 0.8 });

  y += 24;
  rule(doc, y, contentW, BRAND, 2);
  y += 26;

  // Site / where / issue / status grid
  const colW = contentW / 2;
  let rowY = y;
  if (template.siteName) {
    label(doc, 'Site', M, rowY);
    value(doc, `${SITE_NAME} — ${SITE_ADDR}`, M, rowY + 13);
  }
  label(doc, 'Level / area', M + colW, rowY);
  value(doc, `${levelText(ticket.level)} · ${ticket.area}`, M + colW, rowY + 13);
  rowY += 36;
  if (template.tags) {
    label(doc, 'Issue type', M, rowY);
    value(doc, `${ticket.cat} · ${ticket.prio} priority`, M, rowY + 13);
  }
  label(doc, 'Status', M + colW, rowY);
  value(doc, (STATUSES[ticket.status] || STATUSES.open).l, M + colW, rowY + 13);
  y = rowY + 30;
  rule(doc, y, contentW);
  y += 22;

  // Timestamps
  const stamps = [['Created', fmtStamp(ticket.created)]];
  if (template.assignedTime) stamps.push(['Assigned', ticket.assignedAt ? fmtStamp(ticket.assignedAt) : '—']);
  if (template.attendedTime) stamps.push(['Attended', ticket.attendedAt ? fmtStamp(ticket.attendedAt) : '—']);
  if (template.completedTime) stamps.push(['Completed', ticket.completedAt ? fmtStamp(ticket.completedAt) : '—']);
  const stampW = contentW / Math.max(stamps.length, 1);
  stamps.forEach(([l, v], i) => {
    label(doc, l, M + i * stampW, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(v, M + i * stampW, y + 13);
  });
  y += 28;
  rule(doc, y, contentW);
  y += 22;

  // Description
  label(doc, 'Description', M, y);
  y += 13;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...BODY);
  const descLines = doc.splitTextToSize(ticket.desc || '—', contentW);
  doc.text(descLines, M, y);
  y += descLines.length * 13 + 14;

  // Remarks
  if (template.remarks && ticket.remarks) {
    label(doc, `Remarks — completed by ${(ticket.team || 'Cleaning team')}`, M, y);
    y += 13;
    const remarkLines = doc.splitTextToSize(ticket.remarks, contentW);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...BODY);
    doc.text(remarkLines, M, y);
    y += remarkLines.length * 13 + 14;
  }

  // Internal notes (off by default — never on resident reports)
  if (template.internalNotes && ticket.notes) {
    label(doc, 'Internal notes', M, y);
    y += 13;
    const noteLines = doc.splitTextToSize(ticket.notes, contentW);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...BODY);
    doc.text(noteLines, M, y);
    y += noteLines.length * 13 + 14;
  }

  // Photos
  if (template.photos) {
    const before = await collectPhotos(ticket.id, 'before', opts.remoteUrlFor);
    const after = await collectPhotos(ticket.id, 'after', opts.remoteUrlFor);
    if (before.length || after.length) {
      y += 6;
      const half = (contentW - 20) / 2;
      const tileW = Math.min(118, half / 2 - 6);
      const tileH = tileW * 0.75;
      const drawSet = (title, set, x0) => {
        label(doc, title, x0, y);
        let px = x0;
        let py = y + 10;
        set.forEach((ph) => {
          if (px + tileW > x0 + half) { px = x0; py += tileH + 8; }
          try {
            doc.addImage(ph.dataUrl, 'JPEG', px, py, tileW, tileH, undefined, 'FAST');
          } catch { /* skip unrenderable image */ }
          px += tileW + 8;
        });
        return py + tileH + 10;
      };
      const yA = before.length ? drawSet('Before', before, M) : y;
      const yB = after.length ? drawSet('After', after, M + half + 20) : y;
      y = Math.max(yA, yB) + 8;
    }
  }

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  const footY = Math.max(y + 20, pageH - 46);
  rule(doc, footY - 14, contentW);
  if (template.assignedUser) {
    label(doc, `Attended by — ${(ticket.team || 'Unassigned')}`, M, footY);
  }
  doc.setFontSize(7);
  doc.setTextColor(...FAINT);
  doc.text('FOCUSED FACILITIES MANAGEMENT · PAGE 1 OF 1', pageW - M, footY, { align: 'right', charSpace: 0.8 });

  const fileName = `${ticket.ticketNo || 'ticket'}_report.pdf`;
  return { doc, fileName };
}

export async function downloadTicketPdf(ticket, template, opts) {
  const { doc, fileName } = await buildTicketPdf(ticket, template, opts);
  doc.save(fileName);
  return fileName;
}

export async function ticketPdfBase64(ticket, template, opts) {
  const { doc, fileName } = await buildTicketPdf(ticket, template, opts);
  const dataUri = doc.output('datauristring');
  return { base64: dataUri.split(',')[1], fileName };
}
