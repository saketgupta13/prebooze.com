import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronUp, ChevronDown, X } from 'lucide-react';
import { liveMenu, LiveApiError, type LiveMenu } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Menus';
const EMPTY: LiveMenu = { header: [], footer: [] };

/** Header + footer menu editor — real MenuConfig singleton row. */
export default function Menus() {
  const session = useLiveSession();
  const { token } = session;

  const [draft, setDraft] = useState<LiveMenu>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState<ReactNode>('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveMenu
      .get()
      .then((m) => setDraft(JSON.parse(JSON.stringify(m))))
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const setHeader = (header: LiveMenu['header']) => setDraft((d) => ({ ...d, header }));
  const setFooter = (footer: LiveMenu['footer']) => setDraft((d) => ({ ...d, footer }));
  const move = <T,>(arr: T[], i: number, dir: number): T[] => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      await liveMenu.update(draft);
      setMsg(<>Menus saved <Check size={13} /></>);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 780 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}
      {msg && <div className="tiny" style={{ color: 'var(--green)' }}>{msg}</div>}

      <div className="page-hd">
        <h1 className="page-title">Menus</h1>
        <button className="btn btn-pri" disabled={saving} onClick={save}>{saving ? 'Saving…' : <>Save menus <Check size={14} /></>}</button>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>controls the guest site's header nav and footer link groups</div>

      {/* Header */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="display" style={{ fontWeight: 700 }}>Header navigation</div>
        {draft.header.map((link, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" style={{ flex: 1 }} value={link.label} placeholder="Label" onChange={(e) => setHeader(draft.header.map((l, x) => (x === i ? { ...l, label: e.target.value } : l)))} />
            <input className="input" style={{ flex: 1 }} value={link.to} placeholder="/path" onChange={(e) => setHeader(draft.header.map((l, x) => (x === i ? { ...l, to: e.target.value } : l)))} />
            <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setHeader(move(draft.header, i, -1))}><ChevronUp size={13} /></button>
            <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setHeader(move(draft.header, i, 1))}><ChevronDown size={13} /></button>
            <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => setHeader(draft.header.filter((_, x) => x !== i))}><X size={13} /></button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ width: 'fit-content' }} onClick={() => setHeader([...draft.header, { label: 'New link', to: '/' }])}>+ Add header link</button>
      </div>

      {/* Footer groups */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="display" style={{ fontWeight: 700 }}>Footer groups</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setFooter([...draft.footer, { title: 'New group', links: [] }])}>+ Add group</button>
        </div>
        {draft.footer.map((group, gi) => (
          <div key={gi} className="card" style={{ background: 'var(--surface-2)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ flex: 1, fontWeight: 700 }} value={group.title} placeholder="Group title" onChange={(e) => setFooter(draft.footer.map((g, x) => (x === gi ? { ...g, title: e.target.value } : g)))} />
              <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => setFooter(draft.footer.filter((_, x) => x !== gi))}><X size={13} /> group</button>
            </div>
            {group.links.map((link, li) => (
              <div key={li} style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 12 }}>
                <input className="input" style={{ flex: 1 }} value={link.label} placeholder="Label" onChange={(e) => setFooter(draft.footer.map((g, x) => (x === gi ? { ...g, links: g.links.map((l, y) => (y === li ? { ...l, label: e.target.value } : l)) } : g)))} />
                <input className="input" style={{ flex: 1 }} value={link.to} placeholder="/path" onChange={(e) => setFooter(draft.footer.map((g, x) => (x === gi ? { ...g, links: g.links.map((l, y) => (y === li ? { ...l, to: e.target.value } : l)) } : g)))} />
                <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => setFooter(draft.footer.map((g, x) => (x === gi ? { ...g, links: g.links.filter((_, y) => y !== li) } : g)))}><X size={13} /></button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ width: 'fit-content', marginLeft: 12 }} onClick={() => setFooter(draft.footer.map((g, x) => (x === gi ? { ...g, links: [...g.links, { label: 'New link', to: '/' }] } : g)))}>+ Add link</button>
          </div>
        ))}
      </div>

      <button className="btn btn-pri" style={{ width: 'fit-content', padding: 10 }} disabled={saving} onClick={save}>{saving ? 'Saving…' : <>Save menus <Check size={14} /></>}</button>
    </div>
  );
}
