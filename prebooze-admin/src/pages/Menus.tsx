import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import type { FooterGroup, MenuConfig, MenuLink } from '../types';

/** Header + footer menu editor — add, edit, remove and reorder nav items. */
export default function Menus() {
  const { menus, setMenus, toast } = useAdmin();
  const [draft, setDraft] = useState<MenuConfig>(() => JSON.parse(JSON.stringify(menus)));

  const setHeader = (header: MenuLink[]) => setDraft((d) => ({ ...d, header }));
  const setFooter = (footer: FooterGroup[]) => setDraft((d) => ({ ...d, footer }));
  const move = <T,>(arr: T[], i: number, dir: number): T[] => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };
  const save = () => {
    setMenus(draft);
    toast('Menus saved ✓');
  };

  return (
    <div className="stack fade" style={{ maxWidth: 780 }}>
      <div className="page-hd">
        <h1 className="page-title">Menus</h1>
        <button className="btn btn-pri" onClick={save}>Save menus ✓</button>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>controls the guest site's header nav and footer link groups</div>

      {/* Header */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="display" style={{ fontWeight: 700 }}>Header navigation</div>
        {draft.header.map((link, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" style={{ flex: 1 }} value={link.label} placeholder="Label" onChange={(e) => setHeader(draft.header.map((l, x) => (x === i ? { ...l, label: e.target.value } : l)))} />
            <input className="input" style={{ flex: 1 }} value={link.to} placeholder="/path" onChange={(e) => setHeader(draft.header.map((l, x) => (x === i ? { ...l, to: e.target.value } : l)))} />
            <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setHeader(move(draft.header, i, -1))}>↑</button>
            <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setHeader(move(draft.header, i, 1))}>↓</button>
            <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => setHeader(draft.header.filter((_, x) => x !== i))}>✕</button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ width: 'fit-content' }} onClick={() => setHeader([...draft.header, { label: 'New link', to: '/' }])}>+ Add header link</button>
      </div>

      {/* Footer groups */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="display" style={{ fontWeight: 700 }}>Footer groups</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setFooter([...draft.footer, { title: 'New group', links: [] }])}>+ Add group</button>
        </div>
        {draft.footer.map((group, gi) => (
          <div key={gi} className="card" style={{ background: 'var(--surface-2)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ flex: 1, fontWeight: 700 }} value={group.title} placeholder="Group title" onChange={(e) => setFooter(draft.footer.map((g, x) => (x === gi ? { ...g, title: e.target.value } : g)))} />
              <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => setFooter(draft.footer.filter((_, x) => x !== gi))}>✕ group</button>
            </div>
            {group.links.map((link, li) => (
              <div key={li} style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 12 }}>
                <input className="input" style={{ flex: 1 }} value={link.label} placeholder="Label" onChange={(e) => setFooter(draft.footer.map((g, x) => (x === gi ? { ...g, links: g.links.map((l, y) => (y === li ? { ...l, label: e.target.value } : l)) } : g)))} />
                <input className="input" style={{ flex: 1 }} value={link.to} placeholder="/path" onChange={(e) => setFooter(draft.footer.map((g, x) => (x === gi ? { ...g, links: g.links.map((l, y) => (y === li ? { ...l, to: e.target.value } : l)) } : g)))} />
                <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => setFooter(draft.footer.map((g, x) => (x === gi ? { ...g, links: g.links.filter((_, y) => y !== li) } : g)))}>✕</button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ width: 'fit-content', marginLeft: 12 }} onClick={() => setFooter(draft.footer.map((g, x) => (x === gi ? { ...g, links: [...g.links, { label: 'New link', to: '/' }] } : g)))}>+ Add link</button>
          </div>
        ))}
      </div>

      <button className="btn btn-pri" style={{ width: 'fit-content', padding: 10 }} onClick={save}>Save menus ✓</button>
    </div>
  );
}
