// Admin settings — Users (roles), Companies & sites (levels/areas/issues),
// Tags, Report template shortcut, Integrations.
import React, { useState } from 'react';
import { Building2, Plus, X, FileText } from 'lucide-react';
import { C, FONT } from '../constants';
import { mono, Seg } from '../ui.jsx';
import { useSupport } from '../store.jsx';
import { uuid } from '../db';

const card = {
  background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12,
  boxShadow: '0 1px 2px rgba(14,15,17,0.04)',
};
const headCell = { ...mono, fontSize: 10.5, letterSpacing: '0.06em', color: C.faint, fontWeight: 500 };
const ROLE_LABELS = {
  concierge: 'Concierge', cleaning: 'Cleaning team', admin: 'Admin', 'cleaning-admin': 'Cleaning admin',
};

const TABS = [
  ['users', 'Users'], ['sites', 'Companies & sites'], ['tags', 'Tags'],
  ['template', 'Report template'], ['integrations', 'Integrations'],
];

export default function Settings({ go }) {
  const { users, setUsers, companies, saveCompanies, tickets, showToast } = useSupport();
  const [tab, setTab] = useState('users');
  const [sel, setSel] = useState({ co: 0, site: 0 });
  const [invite, setInvite] = useState(null); // {name,email,role,team} | null

  // ------- sites helpers -------
  const selC = companies[Math.min(sel.co, companies.length - 1)] || companies[0];
  const selS = selC?.sites?.[Math.min(sel.site, Math.max(0, (selC?.sites?.length || 1) - 1))] || null;

  const editSite = (fn) => {
    const next = companies.map((c, ci) => ci !== sel.co ? c : {
      ...c, sites: c.sites.map((s, si) => (si !== sel.site ? s : fn(s))),
    });
    saveCompanies(next);
  };
  const removeChip = (key, idx, noun) => {
    const v = selS[key][idx];
    editSite((s) => ({ ...s, [key]: s[key].filter((_, j) => j !== idx) }));
    showToast(`"${v}" removed from ${noun} at ${selS.name}`, 'warn');
  };
  const addChip = (key, noun) => {
    const v = window.prompt(`Add ${noun} to ${selS.name}:`);
    if (!v || !v.trim()) return;
    editSite((s) => ({ ...s, [key]: [...s[key], v.trim()] }));
    showToast(`${noun} added to ${selS.name}`);
  };
  const addSite = (ci) => {
    const next = companies.map((c, i) => i !== ci ? c : {
      ...c,
      sites: [...c.sites, {
        id: uuid(), name: `New site ${c.sites.length + 1}`, addr: 'Add address',
        levels: ['G'], areas: ['Lobby'], issues: ['Spill', 'Rubbish'],
      }],
    });
    saveCompanies(next);
    setSel({ co: ci, site: next[ci].sites.length - 1 });
    showToast('Site added — configure its levels, areas and issue options');
  };
  const addCompany = () => {
    saveCompanies([...companies, { id: uuid(), name: 'New company', sites: [] }]);
    setSel({ co: companies.length, site: 0 });
    showToast('Company created — add its first site');
  };

  // ------- tags -------
  const tagCounts = {};
  tickets.forEach((t) => { tagCounts[t.cat] = (tagCounts[t.cat] || 0) + 1; });
  const siteTags = selS?.issues || Object.keys(tagCounts);

  // ------- invite -------
  const sendInvite = () => {
    if (!invite?.name || !invite?.email) { showToast('Name and email are required', 'err'); return; }
    setUsers([...users, {
      id: uuid(), name: invite.name, email: invite.email,
      role: invite.role || 'concierge', team: invite.team || '', status: 'Invited',
    }]);
    setInvite(null);
    showToast(`Invite sent to ${invite.email}`);
  };

  const chipSpan = (labelText, onRemove, extra) => (
    <span key={labelText + Math.random()} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${C.line}`,
      borderRadius: 999, padding: '6px 12px', fontSize: 13, color: C.body, background: '#fff',
    }}>
      {labelText}
      {extra}
      <X size={12} color={C.faint} strokeWidth={2} style={{ cursor: 'pointer' }} onClick={onRemove} />
    </span>
  );
  const addChipBtn = (labelText, onClick) => (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, border: `1.5px dashed ${C.hair}`,
      borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 600, color: C.grey,
      background: C.paper, cursor: 'pointer', fontFamily: FONT,
    }}>
      <Plus size={13} strokeWidth={2} />
      {labelText}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'bstFade 0.3s ease-out' }}>
      <div style={{ display: 'flex', gap: 6, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 9, padding: 4, alignSelf: 'flex-start' }}>
        {TABS.map(([k, l]) => (
          <Seg key={k} active={tab === k} onClick={() => setTab(k)}>{l}</Seg>
        ))}
      </div>

      {/* USERS */}
      {tab === 'users' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.wash}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15.5, color: C.ink, margin: 0 }}>Users</h3>
            <button onClick={() => setInvite({ name: '', email: '', role: 'concierge', team: '' })} style={{
              height: 34, background: C.ink, color: '#fff', border: 'none', borderRadius: 8,
              padding: '0 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
            }}>
              Invite user
            </button>
          </div>
          {invite && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 1fr 1.2fr auto', gap: 12, padding: '13px 20px', borderBottom: `1px solid ${C.wash}`, background: C.paper, alignItems: 'center' }}>
              <input placeholder="Full name" value={invite.name}
                onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                style={inviteInput} />
              <input placeholder="email@company.com" value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                style={inviteInput} />
              <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} style={inviteInput}>
                <option value="concierge">Concierge</option>
                <option value="cleaning">Cleaning team</option>
                <option value="admin">Admin</option>
              </select>
              <input placeholder="Team (optional)" value={invite.team}
                onChange={(e) => setInvite({ ...invite, team: e.target.value })}
                style={inviteInput} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={sendInvite} style={{ height: 34, background: C.brand, color: '#fff', border: 'none', borderRadius: 7, padding: '0 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Send</button>
                <button onClick={() => setInvite(null)} style={{ height: 34, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 7, padding: '0 12px', fontSize: 12.5, fontWeight: 600, color: C.slate, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 1fr 1.2fr 0.8fr', gap: 12, padding: '11px 20px', borderBottom: `1px solid ${C.wash}` }}>
            {['NAME', 'EMAIL', 'ROLE', 'TEAM', 'STATUS'].map((h) => <span key={h} style={headCell}>{h}</span>)}
          </div>
          {users.map((u) => (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 1fr 1.2fr 0.8fr', gap: 12, padding: '13px 20px', borderBottom: `1px solid ${C.bg}`, alignItems: 'center' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{u.name}</span>
              <span style={{ ...mono, fontSize: 12, color: C.grey }}>{u.email}</span>
              <span style={{ fontSize: 13, color: C.slate }}>{ROLE_LABELS[u.role] || u.role}</span>
              <span style={{ fontSize: 13, color: C.slate }}>{u.team}</span>
              <span>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                  background: u.status === 'Active' ? C.greenWash : C.amberWash,
                  color: u.status === 'Active' ? C.green : C.amber,
                }}>
                  {u.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* COMPANIES & SITES */}
      {tab === 'sites' && (
        <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.wash}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15.5, color: C.ink, margin: 0 }}>Companies</h3>
              <button onClick={addCompany} style={{
                height: 32, background: C.ink, color: '#fff', border: 'none', borderRadius: 8,
                padding: '0 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
              }}>
                Add company
              </button>
            </div>
            <div style={{ padding: '2px 8px 12px', display: 'flex', flexDirection: 'column' }}>
              {companies.map((c, ci) => (
                <React.Fragment key={c.id || c.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `${ci === 0 ? 12 : 18}px 10px 7px` }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: C.ink, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: C.faint, whiteSpace: 'nowrap' }}>{c.sites.length}{c.sites.length === 1 ? ' site' : ' sites'}</span>
                    <span onClick={() => addSite(ci)} style={{ fontSize: 11.5, fontWeight: 600, color: C.slate, border: `1px solid ${C.line}`, borderRadius: 7, padding: '4px 9px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Site</span>
                  </div>
                  {c.sites.map((s, si) => {
                    const active = sel.co === ci && sel.site === si;
                    return (
                      <a key={s.id || s.name} onClick={() => setSel({ co: ci, site: si })} style={{
                        display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px 9px 14px', borderRadius: 8,
                        background: active ? C.bg : 'transparent', cursor: 'pointer', textDecoration: 'none',
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? C.brand : C.hair, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: active ? 600 : 500, color: active ? C.ink : C.slate, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                        <span style={{ fontSize: 11, color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{s.addr}</span>
                      </a>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.wash}`, fontSize: 12, color: C.faint, lineHeight: 1.5 }}>
              Each site carries its own levels, areas and issue options. Staff signed into a site only see that site's setup.
            </div>
          </div>

          {selS ? (
            <div style={{ ...card, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={22} color={C.ink} strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, color: C.ink }}>{selS.name}</div>
                  <div style={{ fontSize: 13, color: C.grey }}>{selS.addr}</div>
                </div>
                <span style={{ ...mono, fontSize: 10, letterSpacing: '0.08em', color: C.grey, background: C.bg, borderRadius: 999, padding: '5px 11px' }}>
                  {selC.name.toUpperCase()}
                </span>
              </div>
              {[
                ['levels', 'LEVELS — SHOWN WHEN PICKING WHERE THE ISSUE IS', 'Level'],
                ['areas', 'AREAS — SHOWN AS CHIPS WHEN CREATING A TICKET', 'Area'],
                ['issues', 'ISSUE OPTIONS — THE BUTTONS STAFF TAP WHEN RAISING A TICKET', 'Issue option'],
              ].map(([key, title, noun]) => (
                <div key={key}>
                  <div style={{ ...mono, fontSize: 10.5, letterSpacing: '0.08em', color: C.grey, marginBottom: 10 }}>{title}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selS[key].map((v, vi) => chipSpan(v, () => removeChip(key, vi, key)))}
                    {addChipBtn(`Add ${noun.toLowerCase()}`, () => addChip(key, noun))}
                  </div>
                  {key === 'issues' && (
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
                      These appear as the tap-to-pick issue buttons on step 1 of ticket creation — on web
                      and mobile — for this site only.
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: '#fff', border: `1px dashed ${C.line}`, borderRadius: 12, padding: 48, textAlign: 'center' }}>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15, color: C.ink }}>No sites yet</div>
              <div style={{ fontSize: 13, color: C.grey, marginTop: 4 }}>
                Add a site to this company to configure its levels, areas and issue options.
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAGS */}
      {tab === 'tags' && (
        <div style={{ ...card, padding: '22px 24px' }}>
          <div style={{ ...mono, fontSize: 10.5, letterSpacing: '0.08em', color: C.grey, marginBottom: 12 }}>
            ISSUE TAGS — COUNTS THIS MONTH
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {siteTags.map((tag, i) => chipSpan(
              tag,
              () => showToast(`"${tag}" tag archived`, 'warn'),
              <span key={`n-${i}`} style={{ ...mono, fontSize: 10.5, color: C.faint }}>{tagCounts[tag] || 0}</span>
            ))}
            {addChipBtn('Add tag', () => {
              if (!selS) { showToast('Select a site first', 'warn'); return; }
              addChip('issues', 'Tag');
            })}
          </div>
        </div>
      )}

      {/* TEMPLATE */}
      {tab === 'template' && (
        <div style={{ ...card, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <FileText size={22} color={C.ink} strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>PDF report template</div>
            <div style={{ fontSize: 13, color: C.grey, marginTop: 2 }}>
              Choose which fields appear on exported reports — times, assigned user, remarks, photos,
              tags and site name.
            </div>
          </div>
          <button onClick={() => go('pdf')} style={{
            height: 38, background: C.ink, color: '#fff', border: 'none', borderRadius: 8,
            padding: '0 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', flex: 'none', fontFamily: FONT,
          }}>
            Open template settings
          </button>
        </div>
      )}

      {/* INTEGRATIONS */}
      {tab === 'integrations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ ...card, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 16, color: C.ink }}>Xero</div>
              <span style={{ ...mono, fontSize: 10, letterSpacing: '0.08em', background: C.wash, color: C.grey, borderRadius: 999, padding: '3px 9px' }}>NOT CONNECTED</span>
            </div>
            <p style={{ fontSize: 13.5, color: C.slate, lineHeight: 1.55, margin: 0 }}>
              Create draft invoices from chargeable jobs and sync invoice numbers back to tickets
              automatically. Without Xero, teams record invoice numbers manually in Billing.
            </p>
            <button onClick={() => showToast('Xero connection — coming with the integrations release', 'warn')} style={{
              height: 38, background: C.ink, color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 13.5, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', padding: '0 16px', fontFamily: FONT,
            }}>
              Connect Xero
            </button>
          </div>
          <div style={{ ...card, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 16, color: C.ink }}>WhatsApp intake</div>
              <span style={{ ...mono, fontSize: 10, letterSpacing: '0.08em', background: C.amberWash, color: C.amber, borderRadius: 999, padding: '3px 9px' }}>COMING LATER</span>
            </div>
            <p style={{ fontSize: 13.5, color: C.slate, lineHeight: 1.55, margin: 0 }}>
              Residents and staff will be able to message photos straight into the ticket queue via the
              WhatsApp Business API. Planned after the core app is stable — adds setup and compliance steps.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const inviteInput = {
  height: 34, border: `1px solid ${C.line}`, borderRadius: 7, padding: '0 10px',
  fontSize: 12.5, color: C.ink, background: '#fff', fontFamily: FONT, minWidth: 0,
};
