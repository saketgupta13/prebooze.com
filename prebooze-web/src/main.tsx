import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AppProvider } from './store/AppContext';
import { setupLinkClickTracking } from './lib/gtm';

setupLinkClickTracking();

// A fresh full page load just fetched the current index.html + hashes, so
// any earlier stale-chunk episode is over — reset the one-shot auto-reload
// guard (see ChunkErrorBoundary) so a future deploy's staleness gets its
// own single recovery attempt instead of being silently skipped.
sessionStorage.removeItem('pb_chunk_reload_attempted');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
);
