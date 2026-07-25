import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import WysiwygEditor from '../components/WysiwygEditor';
import { Tag } from '../components/ui';

const BG = '#0e0f0a';
const CARD = '#171911';
const TEXT = '#f1f3ea';
const MUTED = '#9a9d8c';
const GREEN = '#8bc34a';

const SAMPLE_VALUES: Record<string, string> = {
  name: 'Priya', eventTitle: 'Indie Night Live', bookingId: '#TKT-48213', qty: '2', total: '₹900',
  amount: '₹900', refundNote: 'to your original payment method — usually 5–7 business days to reflect.',
  eventUrl: '#', friendName: 'Rohan', ticketId: 'HT-4821', ticketSubject: 'Refund not received',
  roleLabel: 'organizer', reasonBlock: '<p style="background:rgba(255,107,94,.08);border:1px solid rgba(255,107,94,.25);border-radius:8px;padding:10px 12px;">Business documents didn\'t match the applicant name — please resubmit with matching ID.</p>',
  role: 'organizer', itemLabel: 'organizer (livewire)', roleName: 'Finance', tempPassword: 'Xk9-pQ2r-fA7z',
  jobTitle: 'Senior React Engineer', ownerName: 'Owner', revenue: '₹3,40,000', bookings: '312', payoutsDue: '₹1,20,000',
  periodLabel: '14–20 Jul', invoiceNumber: 'INV-2026-000123', description: '2× General — Indie Night Live',
};

function substitute(tpl: string, data: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key: string) => data[key] ?? '');
}

/** Mirrors prebooze-api/src/notifications/email-templates.ts's layout() —
 * real Prebooze logo (not a text wordmark), same branded card. */
function layout(bodyHtml: string, ctaLabel?: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BG};font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:${CARD};border:1px solid rgba(139,195,74,.18);border-radius:14px;overflow:hidden;">
        <tr><td style="padding:24px 28px 0;"><img src="/logo.png" alt="Prebooze" height="28" style="height:28px;width:auto;display:block;" /></td></tr>
        <tr><td style="padding:20px 28px 8px;color:${TEXT};font-size:14px;line-height:1.6;">${bodyHtml}</td></tr>
        ${ctaLabel ? `<tr><td style="padding:8px 28px 24px;"><a href="#" style="display:inline-block;background:${GREEN};color:#0e0f0a;font-weight:700;font-size:13px;text-decoration:none;padding:11px 20px;border-radius:8px;">${ctaLabel}</a></td></tr>` : '<tr><td style="height:16px;"></td></tr>'}
        <tr><td style="padding:16px 28px 24px;border-top:1px solid rgba(139,195,74,.12);">
          <div style="color:${MUTED};font-size:11px;line-height:1.6;">Prebooze · your city's events, one tap away<br/>prebooze.com</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const CATEGORIES = ['All', 'Guest', 'Roles', 'Admin', 'Custom'];

export default function EmailTemplates() {
  const {
    settings, emailTemplateDefs, customEmailTemplates, emailTemplateOverrides,
    addEmailTemplate, updateEmailTemplate, resetEmailTemplate, removeCustomEmailTemplate,
  } = useAdmin();
  const allTemplates = [...emailTemplateDefs, ...customEmailTemplates];

  const [cat, setCat] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(allTemplates[0]?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');

  const list = cat === 'All' ? allTemplates : allTemplates.filter((t) => t.category === cat);
  const def = allTemplates.find((t) => t.id === selectedId) ?? allTemplates[0];
  const isCustom = customEmailTemplates.some((t) => t.id === def?.id);
  const override = emailTemplateOverrides.find((o) => o.id === def?.id);
  const isCustomized = Boolean(override);

  const select = (id: string) => {
    setSelectedId(id);
    setEditing(false);
    setCreating(false);
  };

  const startEdit = () => {
    if (!def) return;
    setDraftSubject(override?.subject ?? def.defaultSubject);
    setDraftBody(override?.bodyHtml ?? def.defaultBody);
    setEditing(true);
  };

  const save = () => {
    if (!def) return;
    if (!draftSubject.trim() || !draftBody.trim()) return;
    updateEmailTemplate(def.id, { subject: draftSubject, bodyHtml: draftBody });
    setEditing(false);
  };

  const createTemplate = () => {
    if (!newName.trim() || !newSubject.trim() || !newBody.trim()) return;
    addEmailTemplate({ name: newName, subject: newSubject, bodyHtml: newBody });
    setNewName('');
    setNewSubject('');
    setNewBody('');
    setCreating(false);
    setCat('Custom');
  };

  const deleteCustom = () => {
    if (!def) return;
    if (!window.confirm(`Delete "${def.name}"? This can't be undone.`)) return;
    removeCustomEmailTemplate(def.id);
    setSelectedId(allTemplates.find((t) => t.id !== def.id)?.id ?? null);
  };

  const subject = editing ? draftSubject : (override?.subject ?? def?.defaultSubject ?? '');
  const bodyForPreview = editing ? draftBody : (override?.bodyHtml ?? def?.defaultBody ?? '');
  const previewHtml = def ? layout(substitute(bodyForPreview, SAMPLE_VALUES), def.ctaLabel) : '';
  const previewSubject = def ? substitute(subject, SAMPLE_VALUES) : '';

  return (
    <div className="stack fade" style={{ maxWidth: 1200 }}>
      <div className="page-hd">
        <h1 className="page-title">Email templates</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="small muted">{allTemplates.length} templates · sent via Resend from the backend</span>
          <button className="btn btn-pri btn-sm" onClick={() => { setCreating((v) => !v); setEditing(false); }}>+ Add template</button>
        </div>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>
        real sending config lives in <code>prebooze-api/.env</code> (<code>RESEND_API_KEY</code>) · edits/new templates here save to this admin panel's own store — wiring them through to the live sender is a follow-on step, same boundary as the rest of this app until admin has a real backend session.
      </div>

      {creating && (
        <div className="card" style={{ border: '1px solid var(--green)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="display" style={{ fontWeight: 700 }}>New email template</div>
          <div className="field">
            <label>Name</label>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Diwali sale announcement" autoFocus />
          </div>
          <div className="field">
            <label>Subject</label>
            <input className="input" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Email subject line" />
          </div>
          <div className="field">
            <label>Body</label>
            <WysiwygEditor value={newBody} onChange={setNewBody} minHeight={140} />
          </div>
          <div className="tiny hint">custom templates aren't tied to an automatic trigger — send them manually from their detail view once created.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-pri btn-sm" onClick={createTemplate} disabled={!newName.trim() || !newSubject.trim() || !newBody.trim()}>Create ✓</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      <div className="two-col" style={{ gridTemplateColumns: '1fr 1.4fr', gap: 14, alignItems: 'start' }}>
        <div className="stack" style={{ gap: 6 }}>
          {list.map((t) => {
            const custom = customEmailTemplates.some((c) => c.id === t.id);
            const edited = emailTemplateOverrides.some((o) => o.id === t.id);
            return (
              <button
                key={t.id}
                onClick={() => select(t.id)}
                className="card"
                style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', textAlign: 'left', cursor: 'pointer', border: selectedId === t.id ? '1px solid var(--green)' : undefined, color: 'var(--text)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <b style={{ fontSize: 13 }}>{t.name}</b>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {custom && <Tag label="Custom" cls="tag-green" />}
                    {!custom && edited && <Tag label="Edited" cls="tag-green" />}
                    <span className="tiny muted">{t.category}</span>
                  </div>
                </div>
                <div className="tiny muted">{edited ? emailTemplateOverrides.find((o) => o.id === t.id)?.subject : t.defaultSubject}</div>
                <div className="tiny hint">{t.trigger}</div>
              </button>
            );
          })}
          {list.length === 0 && <div className="card muted small">No templates in this category yet.</div>}
        </div>

        {def && (
          <div className="stack" style={{ gap: 10 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div className="display" style={{ fontWeight: 700 }}>{def.name}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!editing && isCustom && (
                    <button className="btn btn-danger btn-sm" onClick={deleteCustom}>✕ Delete</button>
                  )}
                  {!editing && !isCustom && isCustomized && (
                    <button className="btn btn-danger btn-sm" onClick={() => resetEmailTemplate(def.id)}>↺ Reset to default</button>
                  )}
                  {!editing && <button className="btn btn-pri btn-sm" onClick={startEdit}>✎ Edit</button>}
                </div>
              </div>

              {editing ? (
                <>
                  <div className="field">
                    <label>Subject</label>
                    <input className="input" value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Body</label>
                    <WysiwygEditor value={draftBody} onChange={setDraftBody} minHeight={160} />
                  </div>
                  {def.tokens.length > 0 && (
                    <div className="tiny hint">available tokens: {def.tokens.map((t) => `{{${t}}}`).join(', ')}{def.ctaLabel ? ` · CTA button "${def.ctaLabel}" is fixed by code, not editable here` : ''}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-pri btn-sm" onClick={save} disabled={!draftSubject.trim() || !draftBody.trim()}>Save ✓</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                  </div>
                </>
              ) : (
                <div className="tiny muted">{def.trigger}</div>
              )}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(139,195,74,.15)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div>
                  <div className="tiny muted">Subject</div>
                  <b style={{ fontSize: 13 }}>{previewSubject}</b>
                </div>
                <span className="tag tag-green">live preview · sample data</span>
              </div>
              <iframe title={def.name} srcDoc={previewHtml} style={{ width: '100%', height: 460, border: 'none', background: BG }} />
            </div>
          </div>
        )}
      </div>

      <div className="tiny hint">
        weekly summary respects the "Weekly summary email" toggle under <a href="/settings">Settings</a> (currently {settings.weeklyEmail ? 'on' : 'off'}) · every other fixed email fires automatically off the real action (booking, refund, KYC decision, payout, etc.) · custom templates are manual-send only, nothing here is otherwise a manual send button.
      </div>
    </div>
  );
}
