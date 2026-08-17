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
// the guest figure it out.
//
// The "already tried once" marker lives in the URL's query string (not
// sessionStorage — a real deployed test showed sessionStorage.setItem()
// immediately followed by location.reload() can lose the write, reproducing
// 6+ reload loops in ~3s with the flag reading back null every time despite
// sessionStorage correctly surviving a reload when set and reloaded as two
// separate steps — looked like a storage-IPC-vs-navigation race).
//
// The marker also can't be cleared from componentDidMount unconditionally,
// even though "children mounted without throwing" sounds like the right
// signal — also confirmed via real testing. Suspense mounts *this*
// component successfully the instant a lazy import goes *pending*, well
// before it resolves or rejects, so componentDidMount fires with
// state.failed still false and strips the marker before the rejection even
// happens — which is exactly what caused the same infinite-loop symptom a
// second time after switching off sessionStorage. Clearing is deferred and
// re-checks failed state at fire time instead.
const RETRY_PARAM = '_cr';
const CLEAR_DELAY_MS = 4000;

function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk|dynamically imported module/i.test(msg);
}

function alreadyRetried(): boolean {
  return new URLSearchParams(window.location.search).has(RETRY_PARAM);
}

/** Strips the retry marker back out once the page is confirmed healthy, so
 * it doesn't linger in the address bar or get carried into a bookmark/share. */
function clearRetryParam(): void {
  if (!alreadyRetried()) return;
  const url = new URL(window.location.href);
  url.searchParams.delete(RETRY_PARAM);
  window.history.replaceState(window.history.state, '', url.toString());
}

export default class ChunkErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error) && !alreadyRetried()) {
      const url = new URL(window.location.href);
      url.searchParams.set(RETRY_PARAM, '1');
      window.location.replace(url.toString());
    }
  }

  componentDidMount() {
    this.scheduleClear();
  }

  componentDidUpdate() {
    this.scheduleClear();
  }

  componentWillUnmount() {
    if (this.clearTimer) clearTimeout(this.clearTimer);
  }

  private scheduleClear() {
    if (this.clearTimer) clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(() => {
      if (!this.state.failed) clearRetryParam();
    }, CLEAR_DELAY_MS);
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
