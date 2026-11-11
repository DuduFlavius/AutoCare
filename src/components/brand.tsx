'use client';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import type { MouseEventHandler } from 'react';
export function Brand({
  href = '/start',
  onClick,
}: {
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link className="brand" href={href} onClick={onClick} aria-label="AutoCare · pagina principală">
      <span className="brandmark">
        <Settings size={26} strokeWidth={2.1} />
      </span>
      <span className="brand-word">
        Auto<span className="accent">Care</span>
      </span>
    </Link>
  );
}
