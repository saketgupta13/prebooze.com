import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, Check, X, RotateCcw, Pencil } from 'lucide-react';
import WysiwygEditor from '../components/WysiwygEditor';
import { Tag } from '../components/ui';
import { useBranding } from '../lib/useBranding';
import { liveEmailTemplates, LiveApiError, type LiveEmailTemplate } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Email templates';
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

/** Client-side approximation for the draft preview while editing (mirrors
 * prebooze-api's email-templates.ts layout()) — the moment you save, the
 * preview below switches to the real server-rendered one
 * (EmailTemplatesAdminService.preview), which is what actually gets sent. */
function layout(bodyHtml: string, ctaLabel: string | undefined, logoUrl?: string | null): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BG};font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:${CARD};border:1px solid rgba(139,195,74,.18);border-radius:14px;overflow:hidden;">
        <tr><td style="padding:24px 28px 0;"><img src="${logoUrl || '/logo.png'}" alt="Prebooze" height="28" style="height:28px;width:auto;display:block;" /></td></tr>
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
  const session = useLiveSession();
  const { token } = session;
  const { logoUrl } = useBranding();

  const [templates, setTemplates] = useState<LiveEmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [cat, setCat] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');

  const [serverPreview, setServerPreview] = useState<{ subject: string; html: string } | null>(null);
  const [testTo, setTestTo] = useState('');
  const [msg, setMsg] = useState<ReactNode>('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveEmailTemplates
      .list()
      .then((t) => {
        setTemplates(t);
        setSelectedId((prev) => prev ?? t[0]?.id ?? null);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const def = templates.find((t) => t.id === selectedId) ?? templates[0];

  useEffect(() => {
    if (!token || !def || editing) return;
    liveEmailTemplates.preview(def.id).then(setServerPreview).catch(() => setServerPreview(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, def?.id, editing]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const list = cat === 'All' ? templates : templates.filter((t) => t.category === cat);

  const select = (id: string) => {
    setSelectedId(id);
    setEditing(false);
    setCreating(false);
    setMsg('');
  };

  const startEdit = () => {
    if (!def) return;
    setDraftSubject(def.subject);
    setDraftBody(def.bodyHtml);
    setEditing(true);
    setMsg('');
  };

  const save = async () => {
    if (!def) return;
    if (!draftSubject.trim() || !draftBody.trim()) return;
    try {
      await liveEmailTemplates.update(def.id, { subject: draftSubject, bodyHtml: draftBody });
      setEditing(false);
      setMsg(<>Saved <CheckCircle2 size={13} /></>);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save');
    }
  };

  const createTemplate = async () => {
    if (!newName.trim() || !newSubject.trim() || !newBody.trim()) return;
    try {
      const created = await liveEmailTemplates.create({ name: newName, subject: newSubject, bodyHtml: newBody });
      setNewName('');
      setNewSubject('');
      setNewBody('');
      setCreating(false);
      setCat('Custom');
      setSelectedId(created.id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to create template');
    }
  };

  const resetOrDelete = async () => {
    if (!def) return;
    if (def.custom && !window.confirm(`Delete "${def.name}"? This can't be undone.`)) return;
    try {
      await liveEmailTemplates.reset(def.id);
      const remaining = templates.filter((t) => t.id !== def.id);
      setSelectedId(remaining[0]?.id ?? null);
      setMsg(def.custom ? 'Deleted' : <>Reset to default <CheckCircle2 size={13} /></>);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to reset');
    }
  };

  const sendTest = async () => {
    if (!def || !testTo.trim()) return;
    setErr('');
    try {
      await liveEmailTemplates.sendNow(def.id, testTo.trim());
      setMsg(<>Test sent to {testTo.trim()} <CheckCircle2 size={13} /></>);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send test');
    }
  };

  const draftPreviewHtml = def ? layout(substitute(draftBody, SAMPLE_VALUES), def.ctaLabel, logoUrl) : '';
  const draftPreviewSubject = def ? substitute(draftSubject, SAMPLE_VALUES) : '';

  return (
    <div className="stack fade" style={{ maxWidth: 1200 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Email templates</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="small muted">{templates.length} templates · sent via Resend from the backend</span>
          <button className="btn btn-pri btn-sm" onClick={() => { setCreating((v) => !v); setEditing(false); }}>+ Add template</button>
        </div>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>
        edits here change what real transactional emails actually send — EmailService.sendTemplate looks up this exact override.
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
            <button className="btn btn-pri btn-sm" onClick={createTemplate} disabled={!newName.trim() || !newSubject.trim() || !newBody.trim()}>Create <Check size={14} /></button>
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
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => select(t.id)}
              className="card"
              style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', textAlign: 'left', cursor: 'pointer', border: selectedId === t.id ? '1px solid var(--green)' : undefined, color: 'var(--text)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <b style={{ fontSize: 13 }}>{t.name}</b>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {t.custom && <Tag label="Custom" cls="tag-green" />}
                  {!t.custom && t.customized && <Tag label="Edited" cls="tag-green" />}
                  <span className="tiny muted">{t.category}</span>
                </div>
              </div>
              <div className="tiny muted">{t.subject}</div>
              <div className="tiny hint">{t.trigger}</div>
            </button>
          ))}
          {list.length === 0 && <div className="card muted small">No templates in this category yet.</div>}
        </div>

        {def && (
          <div className="stack" style={{ gap: 10 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div className="display" style={{ fontWeight: 700 }}>{def.name}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!editing && (def.custom || def.customized) && (
                    <button className="btn btn-danger btn-sm" onClick={resetOrDelete}>{def.custom ? <><X size={14} /> Delete</> : <><RotateCcw size={14} /> Reset to default</>}</button>
                  )}
                  {!editing && <button className="btn btn-pri btn-sm" onClick={startEdit}><Pencil size={14} /> Edit</button>}
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
                    <button className="btn btn-pri btn-sm" onClick={save} disabled={!draftSubject.trim() || !draftBody.trim()}>Save <Check size={14} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                  </div>
                </>
              ) : (
                <div className="tiny muted">{def.trigger}</div>
              )}
              {msg && !editing && <div className="tiny" style={{ color: 'var(--green)' }}>{msg}</div>}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(139,195,74,.15)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div>
                  <div className="tiny muted">Subject</div>
                  <b style={{ fontSize: 13 }}>{editing ? draftPreviewSubject : (serverPreview?.subject ?? '')}</b>
                </div>
                <span className="tag tag-green">{editing ? 'draft preview · approximate' : 'server-rendered · sample data'}</span>
              </div>
              <iframe title={def.name} srcDoc={editing ? draftPreviewHtml : (serverPreview?.html ?? '')} style={{ width: '100%', height: 460, border: 'none', background: BG }} />
            </div>

            {!editing && (
              <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Send a real test to</label>
                  <input className="input" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
                </div>
                <button className="btn btn-ghost" onClick={sendTest}>Send test</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="tiny hint">
        every fixed email fires automatically off the real action (booking, refund, KYC decision, payout, etc.) · custom templates are manual-send only.
      </div>
    </div>
  );
}
