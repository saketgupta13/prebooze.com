import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent } from 'react';
import { Link2 } from 'lucide-react';

const INLINE_BTN: { cmd: string; label: string; title: string }[] = [
  { cmd: 'bold', label: 'B', title: 'Bold' },
  { cmd: 'italic', label: 'I', title: 'Italic' },
  { cmd: 'underline', label: 'U', title: 'Underline' },
];

const LIST_BTN: { cmd: string; label: string; title: string }[] = [
  { cmd: 'insertUnorderedList', label: '• List', title: 'Bullet list' },
  { cmd: 'insertOrderedList', label: '1. List', title: 'Numbered list' },
];

const BLOCKS = [
  { value: 'P', label: 'Paragraph' },
  { value: 'H1', label: 'Heading 1' },
  { value: 'H2', label: 'Heading 2' },
  { value: 'H3', label: 'Heading 3' },
  { value: 'H4', label: 'Heading 4' },
  { value: 'H5', label: 'Heading 5' },
  { value: 'H6', label: 'Heading 6' },
];

// Toggle commands report their own on/off state via queryCommandState.
const TOGGLE_CMDS = new Set(['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList']);

/** A real, dependency-free WYSIWYG — contentEditable + document.execCommand.
 * Still broadly supported despite being long-deprecated, and pulling in a
 * full editor library (Tiptap/Quill/Slate) for a handful of description
 * fields didn't seem worth the dependency, consistent with how lean the rest
 * of this stack stays (scrypt over bcrypt, no chart library, etc.). Stores
 * real HTML, not a plain-text placeholder string. */
export default function WysiwygEditor({ value, onChange, minHeight = 160 }: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);
  // Which toolbar controls are "on" for the caret's current position —
  // without this, clicking Bold silently toggles the next-typed characters
  // bold with zero visual confirmation, which reads as "the button doesn't
  // do anything" even though it's working (a real gap, not a false alarm).
  const [active, setActive] = useState<Set<string>>(new Set());
  const [block, setBlock] = useState('P');

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
      const tag = document.queryCommandValue('formatBlock').toUpperCase();
      setBlock(BLOCKS.some((b) => b.value === tag) ? tag : 'P');
    } catch {
      setBlock('P');
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

  // Pasting from an external page/doc brings its own inline styles along
  // for the ride (background colors, fonts, absolute font sizes) — the
  // browser's default paste inserts the clipboard's HTML fragment as-is,
  // and this editor has no CSS scoping that would contain it. Forcing a
  // plain-text paste (still perfectly usable — this toolbar's own
  // bold/italic/list/heading commands work as normal afterward) is what
  // every mainstream editor does specifically to prevent this, since
  // there's no reliable middle ground between "keep everything" and "keep
  // nothing" when the source page's styles are arbitrary and unknown.
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    handleInput();
  };

  const addLink = () => {
    const url = window.prompt('Link URL');
    if (url) exec('createLink', url);
  };

  const btnStyle = (isActive: boolean) => ({
    padding: '3px 9px',
    fontSize: 11.5,
    fontWeight: 700,
    background: isActive ? 'var(--green)' : undefined,
    color: isActive ? 'var(--bg)' : undefined,
    borderColor: isActive ? 'var(--green)' : undefined,
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
        <select
          className="input"
          title="Paragraph style"
          style={{ width: 118, padding: '3px 6px', fontSize: 11.5, fontWeight: 700 }}
          value={block}
          onChange={(e) => {
            // execCommand's formatBlock wants the tag wrapped in angle
            // brackets on some browsers (Safari/Firefox) and the bare name
            // on others (Chrome) — passing '<h1>' works everywhere.
            exec('formatBlock', `<${e.target.value.toLowerCase()}>`);
          }}
        >
          {BLOCKS.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
        {INLINE_BTN.map((b) => (
          <button
            key={b.cmd}
            type="button"
            className="btn btn-ghost btn-sm"
            title={b.title}
            style={btnStyle(active.has(b.cmd))}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(b.cmd)}
          >
            {b.label}
          </button>
        ))}
        {LIST_BTN.map((b) => (
          <button
            key={b.cmd}
            type="button"
            className="btn btn-ghost btn-sm"
            title={b.title}
            style={btnStyle(active.has(b.cmd))}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(b.cmd)}
          >
            {b.label}
          </button>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" title="Clear formatting" style={{ padding: '3px 9px', fontSize: 11.5, fontWeight: 700 }} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('removeFormat')}>
          Clear
        </button>
        <button type="button" className="btn btn-ghost btn-sm" title="Link" style={{ padding: '3px 9px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }} onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
          <Link2 size={12} /> Link
        </button>
      </div>
      <div
        ref={ref}
        className="input wysiwyg-body"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={onPaste}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onFocus={refreshActive}
        onBlur={() => setActive(new Set())}
        style={{ minHeight, resize: 'vertical', overflow: 'auto', lineHeight: 1.6, cursor: 'text' }}
      />
    </div>
  );
}
