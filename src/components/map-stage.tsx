'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

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
  const [expanded, setExpanded] = useState(false);

  function expand() {
    const dialog = panel.current;
    if (!dialog) return;
    if (expanded) {
      dialog.close();
      return;
    }
    dialog.removeAttribute('open');
    dialog.showModal();
    setExpanded(true);
    toggle.current?.focus();
  }

  return (
    <dialog
      ref={panel}
      open
      aria-label={title}
      className="ac-map-stage"
      onClose={() => {
        panel.current?.setAttribute('open', '');
        setExpanded(false);
        toggle.current?.focus();
      }}
    >
      <div className="ac-map-stage-bar">
        <span>{title}</span>
        <div className="ac-map-stage-actions">
          {expanded && actions}
          <button ref={toggle} type="button" onClick={expand}>
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
