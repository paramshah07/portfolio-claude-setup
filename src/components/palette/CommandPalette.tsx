import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Command } from 'cmdk';
import { useStore } from '@nanostores/react';
import type { CollectionEntry } from 'astro:content';
import { SECTIONS, palette, type SectionId } from '../../lib/state';
import { hud, thisTableOpen } from '../../lib/state/hud';
import './palette.css';

// The section names are proper names, so search also matches the plain word for each.
const KEYWORDS: Record<SectionId, string[]> = {
  'the-deal': ['home', 'top', 'start'],
  'the-player': ['about', 'bio'],
  'hand-history': ['experience', 'work', 'internships'],
  'the-board': ['projects'],
  'the-table': ['leadership', 'club'],
  showdown: ['contact'],
};

type Key = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>;

/** ⌘K on Apple devices, Ctrl K elsewhere and "/" when nobody is typing. */
export function isShortcut(event: Key, mac: boolean, typing: boolean) {
  if (event.altKey) return false;
  if (event.key.toLowerCase() === 'k') return mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return event.key === '/' && !typing && !event.metaKey && !event.ctrlKey;
}

// A native modal dialog traps focus, closes on Esc and returns focus to whatever opened it.
export default function CommandPalette({ site }: { site: CollectionEntry<'profile'>['data']['site'] }) {
  const open = useStore(palette);
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string>(SECTIONS[0].name);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
    const onKey = (event: KeyboardEvent) => {
      const typing = !!(event.target as Element).closest?.('input, textarea, select, [contenteditable]');
      if (!isShortcut(event, mac, typing)) return;
      event.preventDefault();
      palette.set(event.key === '/' || !palette.get());
    };
    // Safari doesn't focus a button on click, so the nav button takes focus before it opens this.
    const onClick = (event: MouseEvent) => (event.target as Element).closest<HTMLElement>('[data-palette]')?.focus();
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  useEffect(() => {
    if (!open) return dialog.current!.close();
    setSearch('');
    setSelected(SECTIONS[0].name);
    setCopied(false);
    dialog.current!.showModal();
    // The dialog focuses the panel. On a touch screen it stays there, because focusing the
    // search field would raise the keyboard over the sheet.
    if (!matchMedia('(pointer: coarse)').matches) dialog.current!.querySelector('input')!.focus();
  }, [open]);

  // Closing on the element, not through the store, returns focus right away, so a focus call after it sticks.
  const close = () => dialog.current!.close();

  // The dialog makes the page inert but lets Tab leave for the browser's toolbar, so Tab wraps
  // between the two stops instead.
  const trap = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const [input, button] = dialog.current!.querySelectorAll<HTMLElement>('input, button');
    const onButton = document.activeElement === button;
    if (event.shiftKey === onButton) return;
    event.preventDefault();
    (onButton ? input : button).focus();
  };

  const go = (id: SectionId) => {
    close();
    const section = document.getElementById(id)!;
    const heading = section.querySelector<HTMLElement>('h1, h2')!;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' });
  };

  const visit = (href: string) => {
    close();
    window.open(href, '_blank', 'noopener');
  };

  // Stays open to show "Email copied". Falls back to the mail app when the clipboard is blocked.
  const copy = (email: string) =>
    navigator.clipboard.writeText(email).then(
      () => setCopied(true),
      () => (location.href = `mailto:${email}`),
    );

  const links = [
    site.github && { name: 'Open GitHub', href: site.github, keywords: ['code', 'repos'] },
    site.linkedin && { name: 'Open LinkedIn', href: site.linkedin, keywords: ['profile'] },
    site.resumePath && { name: 'Open résumé', href: site.resumePath, keywords: ['resume', 'cv', 'pdf'] },
  ].filter((link) => !!link);
  const enter = <kbd aria-hidden="true">↵</kbd>;

  return (
    <dialog
      ref={dialog}
      className="palette"
      aria-label="Command palette"
      onClose={() => palette.set(false)}
      onKeyDown={trap}
      onClick={(event) => event.target === event.currentTarget && close()}
    >
      <Command className="on-cream" label="Search" loop value={selected} onValueChange={setSelected}>
        <div className="field">
          <Command.Input value={search} onValueChange={setSearch} placeholder="Search" />
          <button type="button" aria-label="Close" onClick={close}>
            <kbd>esc</kbd>
            <span>Close</span>
          </button>
        </div>
        <Command.List>
          <Command.Empty>No matches</Command.Empty>
          <Command.Group heading="Navigate">
            {SECTIONS.map(({ id, name }) => (
              <Command.Item key={id} value={name} keywords={KEYWORDS[id]} onSelect={() => go(id)}>
                {name}
                {enter}
              </Command.Item>
            ))}
          </Command.Group>
          {(site.email || links.length > 0) && (
            <Command.Group heading="Contact">
              {site.email && (
                <Command.Item value="Copy email" keywords={['mail', 'address']} onSelect={() => copy(site.email!)}>
                  {copied ? 'Email copied' : 'Copy email'}
                  {enter}
                </Command.Item>
              )}
              {links.map(({ name, href, keywords }) => (
                <Command.Item key={name} value={name} keywords={keywords} onSelect={() => visit(href)}>
                  {name}
                  {enter}
                </Command.Item>
              ))}
            </Command.Group>
          )}
          <Command.Group heading="Table">
            <Command.Item value="Show performance HUD" keywords={['performance', 'fps', 'frame rate', 'stats']} onSelect={() => (close(), hud.set(true))}>
              Show performance HUD
              <kbd aria-hidden="true">H</kbd>
            </Command.Item>
            <Command.Item value="How this table works" keywords={['about', 'architecture', 'built', 'source']} onSelect={() => (close(), thisTableOpen.set(true))}>
              How this table works
              {enter}
            </Command.Item>
          </Command.Group>
        </Command.List>
        <p role="status" className="sr-only">
          {copied && 'Email copied'}
        </p>
      </Command>
    </dialog>
  );
}
