'use client';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import ReferenceArtwork from './reference-artwork';
import type { MouseEventHandler } from 'react';
export function Brand({
  href = '/start',
  onClick,
  reference=false,
}: {
  href?: string;
  reference?:boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link className="brand" href={href} onClick={onClick} aria-label="AutoCare · pagina principală">
      {reference?<ReferenceArtwork name="wordmark" width={174} height={46} alt="AutoCare"/>:<><span className="brandmark">
        <Settings size={26} strokeWidth={2.1} />
      </span>
      <span className="brand-word">
        Auto<span className="accent">Care</span>
      </span></>}
    </Link>
  );
}
