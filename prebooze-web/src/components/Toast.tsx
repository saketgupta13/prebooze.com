import { useApp } from '../store/AppContext';

/** Global toast — renders app-wide so feedback shows on every page,
 * not just inside the role consoles. */
export default function Toast() {
  const { toastMsg } = useApp();
  if (!toastMsg) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--accent)',
        color: 'var(--on-accent)',
        padding: '10px 18px',
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 13,
        zIndex: 60,
        maxWidth: '90vw',
      }}
    >
      {toastMsg}
    </div>
  );
}
