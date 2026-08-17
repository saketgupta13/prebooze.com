import { Component } from 'react';
import type { ReactNode } from 'react';

// Every route is a separately-hashed JS file (see App.tsx's lazy() calls) —
// each rebuild deletes the old hashes and writes new ones. A guest who had
// the site open before a deploy landed, then clicks to a page they haven't
// visited yet, asks their browser for a filename that no longer exists —
// the fetch 404s, the dynamic import's promise rejects, and with no error
// boundary around Suspense that just left the loading spinner stuck forever
// (Suspense only handles the pending state, not a rejected one). A hard
// refresh "fixed" it only because it re-fetched a current index.html with
// the right hashes. This does that refresh automatically instead of making
// the guest figure it out — but only once: the sessionStorage flag is set
// right before reloading and only cleared once children actually render
// successfully afterward (componentDidMount/componentDidUpdate below), not
// unconditionally at boot — clearing it at boot would erase the "already
// tried" signal on the very reload it's meant to survive, turning a
// genuinely broken deploy (or a truly offline guest) into an infinite
// reload loop instead of the manual-retry fallback below.
const RELOAD_FLAG = 'pb_chunk_reload_attempted';

function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk|dynamically imported module/i.test(msg);
}

export default class ChunkErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
    }
  }

  // Only reached when children mounted/updated without throwing — the
  // reload attempt (if any) actually worked, so clear the flag and give
  // the *next* failure its own fresh one-shot recovery attempt.
  componentDidMount() {
    if (!this.state.failed) sessionStorage.removeItem(RELOAD_FLAG);
  }

  componentDidUpdate() {
    if (!this.state.failed) sessionStorage.removeItem(RELOAD_FLAG);
  }

  render() {
    if (this.state.failed) {
      // Reload above already fired for the common case — this only renders
      // meaningfully if that reload didn't help (already tried once) or the
      // error wasn't chunk-related in the first place.
      return (
        <main className="page">
          <div className="container center" style={{ padding: '80px 0' }}>
            <p className="muted" style={{ marginBottom: 16 }}>Something went wrong loading this page.</p>
            <button className="btn btn-pri" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
