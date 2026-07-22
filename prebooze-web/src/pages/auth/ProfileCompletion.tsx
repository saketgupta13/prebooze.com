import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { INTEREST_TAGS } from '../../data/mock';
import LocationPicker, { emptyLocation } from '../../components/LocationPicker';
import WysiwygEditor from '../../components/WysiwygEditor';

export default function ProfileCompletion() {
  const { user, updateUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [form, setForm] = useState({
    name: user?.name ?? '',
    username: user?.username ?? '',
    dob: user?.dob ?? '',
    gender: user?.gender ?? '',
    email: user?.email ?? '',
    city: user?.city ?? 'Austin',
    profession: user?.profession ?? '',
    languages: user?.languages ?? '',
    bio: user?.bio ?? '',
    socials: user?.socials ?? '',
  });
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [loc, setLoc] = useState(emptyLocation);
  const [photo, setPhoto] = useState(false);

  const pct = useMemo(() => {
    const fields = Object.values(form).filter((v) => v.trim()).length;
    return Math.min(100, 20 + fields * 7 + (interests.length ? 8 : 0) + (photo ? 8 : 0));
  }, [form, interests, photo]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({ ...form, city: loc.city || form.city, interests, profilePct: pct });
    navigate('/verify-id', { state: { from } });
  };

  const skip = () => navigate(from ?? '/');

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ fontSize: 24 }}>Complete your profile</h1>
          <button className="btn btn-ghost btn-sm" onClick={skip}>
            Skip for now
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 22px' }}>
          <div className="progress" style={{ flex: 1 }}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <span className="small muted bold">{pct}% complete</span>
        </div>

        <form className="card" onSubmit={save}>
          <div
            className={`upload-box ${photo ? 'done' : ''}`}
            onClick={() => setPhoto((p) => !p)}
            style={{ marginBottom: 16 }}
          >
            {photo ? '✓ Photo added' : '📷 photo + — Add a profile picture — it appears on your tickets and reviews'}
          </div>

          <div className="form-row">
            <div className="field">
              <span>Full name</span>
              <input value={form.name} onChange={set('name')} placeholder="Full name" />
            </div>
            <div className="field">
              <span>Username</span>
              <input value={form.username} onChange={set('username')} placeholder="@username" />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <span>Date of birth</span>
              <input type="date" value={form.dob} onChange={set('dob')} />
            </div>
            <div className="field">
              <span>Gender</span>
              <select value={form.gender} onChange={set('gender')}>
                <option value="">Select…</option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={set('email')} placeholder="you@mail.com" />
          </div>
          <LocationPicker value={loc} onChange={setLoc} />
          <div className="form-row">
            <div className="field">
              <span>Profession</span>
              <input value={form.profession} onChange={set('profession')} placeholder="What do you do?" />
            </div>
            <div className="field">
              <span>Languages</span>
              <input value={form.languages} onChange={set('languages')} placeholder="English, Hindi…" />
            </div>
          </div>
          <div className="field">
            <span>Bio</span>
            <WysiwygEditor value={form.bio} onChange={(html) => setForm((f) => ({ ...f, bio: html }))} minHeight={70} />
          </div>
          <div className="field">
            <span>Social links</span>
            <input value={form.socials} onChange={set('socials')} placeholder="instagram / X / linkedin +" />
          </div>

          <div className="field">
            <span>Interests</span>
            <div className="chip-row">
              {INTEREST_TAGS.map((t) => (
                <button
                  type="button"
                  key={t}
                  className={`chip ${interests.includes(t) ? 'on' : ''}`}
                  onClick={() =>
                    setInterests((prev) =>
                      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                    )
                  }
                >
                  {t}
                  {interests.includes(t) ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-pri btn-block btn-lg" style={{ marginTop: 8 }}>
            Save & continue →
          </button>
          <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
            Next: ID verification
          </div>
        </form>
      </div>
    </main>
  );
}
