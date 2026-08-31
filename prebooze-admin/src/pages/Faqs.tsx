import { useEffect, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { liveFaqs, LiveApiError, type LiveFaq } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'FAQs';

/** Home / FAQ page questions — real FaqItem rows, grouped by guest vs
 * organizer audience. */
export default function Faqs() {
  const session = useLiveSession();
  const { token } = session;

  const [faqs, setFaqs] = useState<LiveFaq[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [audience, setAudience] = useState<'guests' | 'organizers'>('guests');
  const [editing, setEditing] = useState<LiveFaq | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveFaqs.list().then(setFaqs).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load')).finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const reset = () => { setEditing(null); setQuestion(''); setAnswer(''); };
  const startEdit = (f: LiveFaq) => {
    setEditing(f);
    setAudience(f.audience as 'guests' | 'organizers');
    setQuestion(f.question);
    setAnswer(f.answer);
    window.scrollTo(0, 0);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) { setErr('Question and answer are required'); return; }
    try {
      if (editing) await liveFaqs.update(editing.id, { question: question.trim(), answer: answer.trim(), audience });
      else await liveFaqs.create({ question: question.trim(), answer: answer.trim(), audience });
      reset();
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this FAQ?')) return;
    try { await liveFaqs.remove(id); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  const list = faqs.filter((f) => f.audience === audience);

  return (
    <div className="stack fade" style={{ maxWidth: 800 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">FAQs</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`chip ${audience === 'guests' ? 'on' : ''}`} onClick={() => setAudience('guests')}>For guests ({faqs.filter((f) => f.audience === 'guests').length})</button>
          <button className={`chip ${audience === 'organizers' ? 'on' : ''}`} onClick={() => setAudience('organizers')}>For organizers ({faqs.filter((f) => f.audience === 'organizers').length})</button>
        </div>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>shown on the guest home page and the /faqs page</div>

      <form className="card" style={{ border: '1px solid var(--green)', display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={save}>
        <div className="display" style={{ fontWeight: 700 }}>{editing ? 'Edit FAQ' : `Add FAQ · ${audience}`}</div>
        <div className="field">
          <label>Question</label>
          <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} />
        </div>
        <div className="field">
          <label>Answer</label>
          <textarea className="input" style={{ minHeight: 56, resize: 'vertical' }} value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-pri btn-sm">{editing ? <>Save changes <Check size={14} /></> : 'Add FAQ'}</button>
          {editing && <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div className="stack" style={{ gap: 8 }}>
        {list.map((f) => (
          <div key={f.id} className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bold" style={{ fontSize: 13 }}>{f.question}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{f.answer}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(f)}><Pencil size={13} /></button>
            <button className="btn btn-danger btn-sm" onClick={() => remove(f.id)}><X size={13} /></button>
          </div>
        ))}
        {list.length === 0 && !loading && <div className="card muted small">No {audience} FAQs yet.</div>}
      </div>
    </div>
  );
}
