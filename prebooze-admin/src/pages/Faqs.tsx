import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import type { FaqItem } from '../types';

/** Home / FAQ page questions — grouped by guest vs organizer audience. */
export default function Faqs() {
  const { faqs, addFaq, updateFaq, removeFaq, toast } = useAdmin();
  const [audience, setAudience] = useState<'guests' | 'organizers'>('guests');
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const reset = () => {
    setEditing(null);
    setQuestion('');
    setAnswer('');
  };
  const startEdit = (f: FaqItem) => {
    setEditing(f);
    setAudience(f.audience);
    setQuestion(f.question);
    setAnswer(f.answer);
    window.scrollTo(0, 0);
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      toast('Question and answer are required');
      return;
    }
    if (editing) updateFaq(editing.id, { question: question.trim(), answer: answer.trim(), audience });
    else addFaq({ id: 'f' + Date.now(), question: question.trim(), answer: answer.trim(), audience });
    reset();
  };

  const list = faqs.filter((f) => f.audience === audience);

  return (
    <div className="stack fade" style={{ maxWidth: 800 }}>
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
          <button type="submit" className="btn btn-pri btn-sm">{editing ? 'Save changes ✓' : 'Add FAQ'}</button>
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
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(f)}>✎</button>
            <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Remove this FAQ?')) removeFaq(f.id); }}>✕</button>
          </div>
        ))}
        {list.length === 0 && <div className="card muted small">No {audience} FAQs yet.</div>}
      </div>
    </div>
  );
}
