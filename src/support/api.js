// Remote (Supabase) side of the support app. Every call is guarded so the
// app keeps working with no backend configured (demo mode) or no network.
import { supabase } from '@/lib/supabaseClient';

export const supaConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

const BUCKET = 'ticket-photos';

// snake_case DB row -> camelCase app ticket
function fromRow(r) {
  return {
    id: r.id,
    ticketNo: r.ticket_no,
    level: r.level,
    area: r.area,
    cat: r.category,
    prio: r.priority,
    status: r.status,
    desc: r.description || '',
    by: r.created_by_label || '',
    team: r.team || '',
    created: r.created_at,
    assignedAt: r.assigned_at,
    attendedAt: r.attended_at,
    completedAt: r.completed_at,
    remarks: r.remarks || '',
    chargeable: !!r.chargeable,
    invoiceNo: r.invoice_no || '',
    notes: r.internal_notes || '',
    updatedAt: r.updated_at,
    synced: true,
  };
}

function toRow(t, userId) {
  return {
    id: t.id,
    ticket_no: t.ticketNo,
    level: t.level,
    area: t.area,
    category: t.cat,
    priority: t.prio,
    status: t.status,
    description: t.desc,
    created_by: userId || null,
    created_by_label: t.by,
    team: t.team || null,
    created_at: t.created,
    assigned_at: t.assignedAt || null,
    attended_at: t.attendedAt || null,
    completed_at: t.completedAt || null,
    remarks: t.remarks || null,
    chargeable: !!t.chargeable,
    invoice_no: t.invoiceNo || null,
    internal_notes: t.notes || null,
  };
}

export const remote = {
  async pullTickets() {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data || []).map(fromRow);
  },

  // Idempotent: rows are keyed by the client-generated uuid, so replaying a
  // queued create after a flaky sync can never duplicate a ticket.
  async upsertTicket(ticket, userId) {
    const { data, error } = await supabase
      .from('support_tickets')
      .upsert(toRow(ticket, userId), { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data);
  },

  async patchTicket(id, patch) {
    const row = {};
    const map = {
      status: 'status', remarks: 'remarks', team: 'team',
      assignedAt: 'assigned_at', attendedAt: 'attended_at', completedAt: 'completed_at',
      chargeable: 'chargeable', invoiceNo: 'invoice_no', prio: 'priority',
    };
    for (const [k, col] of Object.entries(map)) {
      if (k in patch) row[col] = patch[k] === '' ? null : patch[k];
    }
    if (!Object.keys(row).length) return null;
    const { data, error } = await supabase
      .from('support_tickets')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data);
  },

  async uploadPhoto(photo) {
    const path = `${photo.ticketId}/${photo.id}-${photo.name}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, photo.blob, { upsert: true, contentType: photo.blob?.type || 'image/jpeg' });
    if (upErr) throw upErr;
    const { error } = await supabase.from('support_ticket_photos').upsert(
      {
        id: photo.id,
        ticket_id: photo.ticketId,
        kind: photo.kind,
        file_name: photo.name,
        storage_path: path,
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
    return path;
  },

  async pullPhotos() {
    const { data, error } = await supabase
      .from('support_ticket_photos')
      .select('*')
      .limit(2000);
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      ticketId: r.ticket_id,
      kind: r.kind,
      name: r.file_name,
      storagePath: r.storage_path,
      uploaded: true,
    }));
  },

  photoUrl(storagePath) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return data?.publicUrl || null;
  },

  async myProfile() {
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!session) return null;
    const { data, error } = await supabase
      .from('support_profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      name: data.full_name || session.user.email,
      email: data.email || session.user.email,
      role: data.role,
      team: data.team || '',
    };
  },

  async listUsers() {
    const { data, error } = await supabase
      .from('support_profiles')
      .select('*')
      .order('full_name');
    if (error) throw error;
    return (data || []).map((u) => ({
      id: u.id,
      name: u.full_name || u.email,
      email: u.email,
      role: u.role,
      team: u.team || '',
      status: u.status === 'invited' ? 'Invited' : 'Active',
    }));
  },

  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return this.myProfile();
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async emailReport({ ticketNo, summary, pdfBase64, fileName }) {
    const { data, error } = await supabase.functions.invoke('sendTicketReport', {
      body: { ticketNo, summary, pdfBase64, fileName },
    });
    if (error) throw error;
    return data;
  },
};
