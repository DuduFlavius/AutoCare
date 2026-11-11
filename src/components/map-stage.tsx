'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export default function MapStage({
  title,
  english,
  children,
  actions,
}: {
  title: string;
  english: boolean;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const panel = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const wasExpanded = useRef(false);
  const [expanded, setExpanded] = useState(false);

  // Own the native dialog state after React commits. Reopening in onClose alone
  // races the browser's close algorithm and can leave the embedded map hidden.
  useLayoutEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    if (expanded) {
      if (!dialog.matches(':modal')) {
        dialog.removeAttribute('open');
        dialog.showModal();
      }
    } else {
      if (dialog.matches(':modal')) dialog.close();
      dialog.setAttribute('open', '');
    }
    if (expanded || wasExpanded.current) toggle.current?.focus({ preventScroll: true });
    wasExpanded.current = expanded;
  }, [expanded]);

  function expand() {
    setExpanded(value => !value);
  }

  return (
    <dialog
      ref={panel}
      aria-label={title}
      className="ac-map-stage"
      onClose={() => setExpanded(false)}
      onCancel={event => { event.preventDefault(); setExpanded(false); }}
    >
      <div className="ac-map-stage-bar">
        <span>{title}</span>
        <div className="ac-map-stage-actions">
          {expanded && actions}
          <button ref={toggle} type="button" aria-expanded={expanded} onClick={expand}>
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {expanded
              ? english
                ? 'Exit full screen'
                : 'Închide ecranul complet'
              : english
                ? 'Full screen'
                : 'Ecran complet'}
          </button>
        </div>
      </div>
      {children}
    </dialog>
  );
}
