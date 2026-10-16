/*
 * Difficulty: no copy, cut, paste or drag-and-drop of text anywhere in the game. Every prompt, email
 * and post gets typed by hand. The dev panel (#dev) is exempt so testing stays bearable.
 */
const exempt = (t: EventTarget | null) => t instanceof Element && !!t.closest('#dev');

export function disableClipboard(): void {
  const block = (e: Event) => { if (!exempt(e.target)) e.preventDefault(); };
  for (const type of ['copy', 'cut', 'paste', 'dragstart', 'drop']) document.addEventListener(type, block, true);
  // belt and braces for paths that skip the paste/drop events (mobile keyboards, autofill menus)
  document.addEventListener('beforeinput', (e) => {
    if (/^insertFrom(Paste|Drop)/.test(e.inputType) && !exempt(e.target)) e.preventDefault();
  }, true);
}
