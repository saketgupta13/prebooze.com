import { Link, useParams } from 'react-router-dom';

const PAGES: Record<string, { title: string; sections: string[] }> = {
  terms: {
    title: 'Terms & Conditions',
    sections: [
      'Introduction',
      'Account & eligibility',
      'Booking & payments',
      'Cancellations',
      'Conduct at events',
      'Liability',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: ['Data we collect', 'How we use it', 'Sharing & WhatsApp', 'Government ID data', 'Your rights'],
  },
  'organizer-policy': {
    title: 'Organizer Policy',
    sections: ['Verification & KYC', 'Listing standards', 'Payouts & fees', 'Approval & rejection', 'Suspension'],
  },
  'guest-policy': {
    title: 'Guest Policy',
    sections: ['Entry requirements', 'Age & ID checks', 'Ticket transfers', 'Code of conduct', 'Bans & reporting'],
  },
  'refund-policy': {
    title: 'Refund Policy',
    sections: ['Cancellation window', 'Refund timelines', 'Event cancelled by organizer', 'Non-refundable cases'],
  },
  disclaimer: {
    title: 'Disclaimer',
    sections: ['Third-party events', 'No warranty', 'Assumption of risk'],
  },
};

// Placeholder copy — real legal text must be drafted/reviewed by counsel before launch.
const PLACEHOLDER =
  'This section is placeholder copy from the design handoff. Final legal language will be drafted and reviewed by counsel before the platform ships. It will describe, in plain terms, the rights and responsibilities that apply to everyone using Prebooze.';

export default function Legal() {
  const { page } = useParams();
  const doc = PAGES[page ?? ''] ?? PAGES.terms;

  return (
    <main className="page">
      <div className="container legal-grid">
        <aside className="toc card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }} className="muted">
            On this page
          </h3>
          {doc.sections.map((s, i) => (
            <a key={s} href={`#s${i + 1}`}>
              {i + 1}. {s}
            </a>
          ))}
          <div className="hr" />
          {Object.entries(PAGES).map(([slug, p]) => (
            <Link key={slug} to={`/legal/${slug}`} className={p.title === doc.title ? 'accent' : ''}>
              {p.title}
            </Link>
          ))}
        </aside>

        <article>
          <h1 style={{ fontSize: 26 }}>{doc.title}</h1>
          <p className="muted-2 small" style={{ margin: '6px 0 26px' }}>
            Last updated: 1 July 2026
          </p>
          {doc.sections.map((s, i) => (
            <section key={s} id={`s${i + 1}`} style={{ marginBottom: 26 }}>
              <h2 style={{ fontSize: 17, marginBottom: 8 }}>
                {i + 1}. {s}
              </h2>
              <p className="muted small">{PLACEHOLDER}</p>
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
