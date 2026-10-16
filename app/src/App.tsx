import { useEffect, useRef } from 'react';
import { useGame } from './game/useGame';
import { renderApp } from './ui/view';

export default function App() {
  const store = useGame();
  const hostRef = useRef<HTMLDivElement>(null);

  // Re-render the whole browser from the store on every change, preserving the focused field.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const focus = active && host.contains(active) && active.id
      ? { id: active.id, start: active.selectionStart, end: active.selectionEnd }
      : null;
    host.innerHTML = renderApp(store);
    if (focus) {
      const el = host.querySelector<HTMLInputElement>('#' + CSS.escape(focus.id));
      if (el) {
        el.focus();
        try { if (focus.start != null) el.setSelectionRange(focus.start, focus.end ?? focus.start); } catch { /* non-text input */ }
      }
    }
  });

  // Event delegation, attached once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const val = (sel: string) => (host.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
    const trendingToday = () => store.content.trending[store.state.values.day] ?? [];

    const onClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-nav],[data-tab],[data-close],[data-newtab],[data-act],[data-like],[data-deploy],[data-takedown],[data-wallet],[data-copy-addr],[data-mail-discard]');
      if (!t) return;
      e.preventDefault();
      const d = t.dataset;
      if (d.nav != null) store.navigate(d.nav);
      else if (d.tab != null) store.switchTab(Number(d.tab));
      else if (d.close != null) store.closeTab(Number(d.close));
      else if (d.newtab != null) store.navigate('newtab', true);
      else if (d.like != null) store.like(d.like);
      else if (d.deploy != null) store.deploy(d.deploy);
      else if (d.takedown != null) { if (confirm('Take it offline? It counts as broken at payday.')) store.takeDown(d.takedown); }
      else if (d.mailDiscard != null) { store.setDraft(null); store.navigate('qmail.com'); }
      else if (d.wallet != null || d.copyAddr != null) { /* cosmetic */ }
      else if (d.act === 'endday') store.endDay();
      else if (d.act === 'new') { if (confirm('Start over? This erases your save.')) store.newGame(); }
      else if (d.act === 'dev') store.toggleDev();
    };

    const onSubmit = (e: SubmitEvent) => {
      const f = (e.target as HTMLElement).closest<HTMLFormElement>('[data-form]');
      if (!f) return;
      e.preventDefault();
      const kind = f.dataset.form;
      if (kind === 'url') { store.navigate(val('#nt-url') || val('#address')); }
      else if (kind === 'ypost') { const v = val('#post-input').trim(); if (v) void store.post(v, trendingToday()); }
      else if (kind === 'prompt') {
        const v = val('#prompt-input').trim();
        const project = val('#project-pick');
        if (v && project) void store.build(project, v);
      } else if (kind === 'mail') {
        const to = val('#mail-to').trim();
        const body = val('#mail-body').trim();
        if (to && body) void store.compose(to, body).then(() => { store.setDraft(null); store.navigate('qmail.com'); });
      } else if (kind === 'reply') {
        const id = f.dataset.id!;
        const v = val('#reply-body').trim();
        if (v) void store.reply(id, v);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.id === 'prompt-input' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (el as HTMLTextAreaElement).form?.requestSubmit(); }
      if ((el.id === 'post-input' || el.id === 'mail-body' || el.id === 'reply-body') && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); (el as HTMLTextAreaElement).form?.requestSubmit(); }
    };

    const onInput = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (el.id === 'y-search') store.setYSearch(el.value);
    };

    host.addEventListener('click', onClick);
    host.addEventListener('submit', onSubmit);
    host.addEventListener('keydown', onKey);
    host.addEventListener('input', onInput);
    return () => {
      host.removeEventListener('click', onClick);
      host.removeEventListener('submit', onSubmit);
      host.removeEventListener('keydown', onKey);
      host.removeEventListener('input', onInput);
    };
  }, [store]);

  return <div id="app" ref={hostRef} />;
}
