import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AdminProvider } from './store/AdminContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AdminProvider>
        <App />
      </AdminProvider>
    </BrowserRouter>
  </StrictMode>
);
