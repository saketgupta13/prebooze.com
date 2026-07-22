import { useEffect, useRef, useState } from 'react';

const BTN: { cmd: string; label: string; title: string; block?: string }[] = [
  { cmd: 'bold', label: 'B', title: 'Bold' },
  { cmd: 'italic', label: 'I', title: 'Italic' },
  { cmd: 'underline', label: 'U', title: 'Underline' },
  { cmd: 'formatBlock', label: 'H2', title: 'Heading', block: 'h2' },
  { cmd: 'insertUnorderedList', label: '• List', title: 'Bullet list' },
  { cmd: 'insertOrderedList', label: '1. List', title: 'Numbered list' },
  { cmd: 'removeFormat', label: 'Clear', title: 'Clear formatting' },
];

// Toggle commands report their own on/off state; formatBlock doesn't (it
// reports the current block's tag name instead), so it's checked separately.
const TOGGLE_CMDS = new Set(['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList']);

/** A real, dependency-free WYSIWYG — contentEditable + document.execCommand.
 * Still broadly supported despite being long-deprecated, and pulling in a
 * full editor library (Tiptap/Quill/Slate) for two textareas in an admin
 * tool didn't seem worth the dependency, consistent with how lean the rest
 * of this stack stays (scrypt over bcrypt, no chart library, etc.). Stores
 * real HTML, not the mock's old plain-text placeholder strings. */
export default function WysiwygEditor({ value, onChange, minHeight = 160 }: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);
  // Which toolbar buttons are "on" for the caret's current position — without
  // this, clicking Bold silently toggles the next-typed characters bold with
  // zero visual confirmation, which reads as "the button doesn't do anything"
  // even though it's working (a real gap, not a false alarm).
  const [active, setActive] = useState<Set<string>>(new Set());

  const refreshActive = () => {
    if (document.activeElement !== ref.current) return;
    const next = new Set<string>();
    for (const cmd of TOGGLE_CMDS) {
      try {
        if (document.queryCommandState(cmd)) next.add(cmd);
      } catch {
        // unsupported in this browser — leave it off rather than throw
      }
    }
    try {
      if (document.queryCommandValue('formatBlock').toLowerCase() === 'h2') next.add('formatBlock:h2');
    } catch {
      // ignore
    }
    setActive(next);
  };

  useEffect(() => {
    document.addEventListener('selectionchange', refreshActive);
    return () => document.removeEventListener('selectionchange', refreshActive);
  }, []);

  // Mixing React-controlled rendering with a live contentEditable region
  // fights the DOM (cursor jumps, wiped edits on re-render) — so the
  // element's HTML is only ever set imperatively here, never via React's
  // own render, and only when the value changed from *outside* this editor
  // (e.g. switching which event/page is being edited), not on every
  // keystroke echoed back through onChange.
  useEffect(() => {
    if (ref.current && value !== lastValue.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = value;
      lastValue.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value;
    // only on mount — subsequent syncs are handled by the effect above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    handleInput();
    refreshActive();
  };

  const handleInput = () => {
    if (!ref.current) return;
    lastValue.current = ref.current.innerHTML;
    onChange(ref.current.innerHTML);
  };

  const addLink = () => {
    const url = window.prompt('Link URL');
    if (url) exec('createLink', url);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {BTN.map((b) => {
          const activeKey = b.cmd === 'formatBlock' ? `formatBlock:${b.block}` : b.cmd;
          const isActive = b.cmd !== 'removeFormat' && active.has(activeKey);
          return (
            <button
              key={b.cmd + (b.block ?? '')}
              type="button"
              className="btn btn-ghost btn-sm"
              title={b.title}
              style={{
                padding: '3px 9px',
                fontSize: 11.5,
                fontWeight: 700,
                background: isActive ? 'var(--green)' : undefined,
                color: isActive ? 'var(--bg)' : undefined,
                borderColor: isActive ? 'var(--green)' : undefined,
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(b.cmd, b.block)}
            >
              {b.label}
            </button>
          );
        })}
        <button type="button" className="btn btn-ghost btn-sm" title="Link" style={{ padding: '3px 9px', fontSize: 11.5 }} onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
          🔗 Link
        </button>
      </div>
      <div
        ref={ref}
        className="input"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onFocus={refreshActive}
        onBlur={() => setActive(new Set())}
        style={{ minHeight, resize: 'vertical', overflow: 'auto', lineHeight: 1.6, cursor: 'text' }}
      />
    </div>
  );
}
