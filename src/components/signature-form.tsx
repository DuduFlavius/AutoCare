'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { LoaderCircle, X, type LucideIcon } from 'lucide-react';
import { useApplicationLanguage } from './application-locale';

export function SignatureDialog({ title, icon: Icon, children, onClose, busy, compact }: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
  compact?: boolean;
}) {
  const en = useApplicationLanguage() === 'en';
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background: { node: HTMLElement; inert: boolean }[] = [];
    for (let node: HTMLElement | null = element; node?.parentElement && node !== document.body; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node && sibling instanceof HTMLElement && !sibling.matches('style,script,link')) {
          background.push({ node: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
    }
    heading.current?.focus({ preventScroll: true });
    const viewport = window.visualViewport;
    const resize = () => {
      if (!viewport) return;
      element.parentElement?.style.setProperty('--sf-viewport', viewport.height + 'px');
      element.parentElement?.style.setProperty('--sf-offset', viewport.offsetTop + 'px');
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      document.body.style.overflow = overflow;
      background.forEach(({ node, inert }) => { node.inert = inert; });
      previous?.focus({ preventScroll: true });
    };
  }, []);

  return <div className="sf-backdrop">
    <div className="sf-window" ref={root} role="dialog" aria-modal="true" aria-labelledby={titleId}
      data-compact={compact || undefined} onKeyDown={event => {
        if (event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close.current();
        }
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button, input:not([type=hidden]), textarea, select, summary, a[href], [tabindex="0"]',
        )).filter(node => !node.matches(':disabled,[tabindex="-1"]') && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
        const first = controls[0], last = controls.at(-1);
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === heading.current)) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first?.focus();
        }
      }}>
      <header className="sf-header">
        <span className="sf-header-icon"><Icon size={22} aria-hidden="true" /></span>
        <h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2>
        <button className="sf-close" type="button" aria-label={en ? 'Close' : 'Închide'} disabled={busy} onClick={onClose}><X size={20} /></button>
      </header>
      {children}
    </div>
  </div>;
}

export function SignatureActions({ children, onCancel, busy, label, status, cancelLabel, disabled }: {
  children?: ReactNode;
  onCancel: () => void;
  busy: boolean;
  label: string;
  status?: string;
  cancelLabel?: string;
  disabled?: boolean;
}) {
  const en = useApplicationLanguage() === 'en';
  return <footer className="sf-actions">
    {children && <div className="sf-actions-extra">{children}</div>}
    <div className="sf-actions-primary">
      <button type="button" disabled={busy} onClick={onCancel}>{cancelLabel ?? (en ? 'Cancel' : 'Anulează')}</button>
      <button type="submit" className="sf-primary" disabled={busy || disabled}>
        {busy && <LoaderCircle size={16} className="sf-spinner" aria-hidden="true" />}
        {busy ? status ?? (en ? 'Saving…' : 'Se salvează…') : label}
      </button>
    </div>
  </footer>;
}
