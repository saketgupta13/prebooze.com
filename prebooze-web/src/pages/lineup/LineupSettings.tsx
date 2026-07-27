import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import WysiwygEditor from '../../components/WysiwygEditor';
import { FileDropBox } from '../../components/FileDropBox';
import ChangePhoneNumber from '../../components/ChangePhoneNumber';

const CATEGORIES = ['Artist', 'DJ', 'Band', 'Comedian', 'Sponsor', 'Promoter', 'Host'];

export default function LineupSettings() {
  const { user, updateUser, toast } = useApp();
  const [photo, setPhoto] = useState('');
  const [form, setForm] = useState({
    lineupName: user?.lineupName ?? '',
    lineupCategory: user?.lineupCategory ?? 'DJ',
    city: user?.city ?? '',
    bio: user?.bio ?? '',
    socials: user?.socials ?? '',
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser(form);
    toast('Artist profile saved ✓');
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Profile & settings</h1>
      <div style={{ marginBottom: 16 }}>
        <ChangePhoneNumber />
      </div>
      <form className="card" onSubmit={save}>
        <FileDropBox
          value={photo}
          onChange={setPhoto}
          label="📷 photo + — Add a profile photo — shown on your public profile and event posters"
          doneLabel="✓ Photo added — click to replace"
          style={{ marginBottom: 16 }}
        />
        <div className="form-row">
          <div className="field">
            <span>Stage name</span>
            <input value={form.lineupName} onChange={set('lineupName')} placeholder="e.g. DJ Nova" />
          </div>
          <div className="field">
            <span>Category</span>
            <select value={form.lineupCategory} onChange={set('lineupCategory')}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <span>Based in</span>
          <input value={form.city} onChange={set('city')} placeholder="City" />
        </div>
        <div className="field">
          <span>Bio</span>
          <WysiwygEditor value={form.bio} onChange={(html) => setForm((f) => ({ ...f, bio: html }))} minHeight={80} />
        </div>
        <div className="field">
          <span>Links (socials / music)</span>
          <input value={form.socials} onChange={set('socials')} placeholder="ig / spotify / soundcloud" />
        </div>
        <button className="btn btn-pri btn-block btn-lg" style={{ marginTop: 8 }}>Save changes</button>
      </form>
    </div>
  );
}
