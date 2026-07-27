import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { CITIES, INTEREST_TAGS } from '../data/mock';
import WysiwygEditor from '../components/WysiwygEditor';
import ChangePhoneNumber from '../components/ChangePhoneNumber';

export default function EditProfile() {
  const { user, updateUser } = useApp();
  const navigate = useNavigate();

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

  if (!user) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({ ...form, interests });
    navigate('/profile');
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="breadcrumb">
          <Link to="/profile">← Profile</Link> / Edit profile ·{' '}
          <span className="accent">{user.profilePct}% complete</span>
        </div>
        <h1 style={{ fontSize: 24, marginBottom: 18 }}>Edit profile</h1>

        <form className="card" onSubmit={save}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <span className="avatar" style={{ width: 58, height: 58, fontSize: 26 }}>
              👤
            </span>
            <button type="button" className="btn btn-ghost btn-sm">
              Change photo
            </button>
            <button type="button" className="btn btn-ghost btn-sm">
              Remove
            </button>
          </div>

          <div className="form-row">
            <div className="field">
              <span>Full name</span>
              <input value={form.name} onChange={set('name')} />
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
          <div className="form-row">
            <div className="field">
              <span>Email</span>
              <input type="email" value={form.email} onChange={set('email')} />
            </div>
            <div className="field">
              <span>City</span>
              <select value={form.city} onChange={set('city')}>
                {CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <span>Profession</span>
              <input value={form.profession} onChange={set('profession')} />
            </div>
            <div className="field">
              <span>Languages</span>
              <input value={form.languages} onChange={set('languages')} />
            </div>
          </div>
          <div className="field">
            <span>Bio</span>
            <WysiwygEditor value={form.bio} onChange={(html) => setForm((f) => ({ ...f, bio: html }))} minHeight={70} />
          </div>
          <div className="field">
            <span>Social links</span>
            <input value={form.socials} onChange={set('socials')} placeholder="ig/… · x/… · in/… +" />
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

          <div style={{ marginBottom: 16 }}>
            <ChangePhoneNumber />
            {user.idVerified && (
              <div className="tiny muted-2" style={{ marginTop: 6 }}>Aadhaar verified <span className="verified">✓</span></div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-pri">Save changes</button>
            <Link to="/profile" className="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
