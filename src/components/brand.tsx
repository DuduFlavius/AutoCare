'use client';
import Link from 'next/link';
import { Settings,CarFront } from 'lucide-react';
import ReferenceArtwork from './reference-artwork';
import type { MouseEventHandler } from 'react';
export function Brand({
  href = '/start',
  onClick,
  reference=false,
  racing=false,
  label="AutoCare · pagina principală",
}: {
  href?: string;
  reference?:boolean;
  racing?:boolean;
  label?:string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link className="brand" href={href} onClick={onClick} aria-label={label}>
      {racing?<span className="rg-brand-lockup"><CarFront size={40} strokeWidth={1.3}/><span>Auto<span>Care</span><small>Premium</small></span></span>:reference?<ReferenceArtwork name="wordmark" width={174} height={46} alt="AutoCare"/>:<><span className="brandmark">
        <Settings size={26} strokeWidth={2.1} />
      </span>
      <span className="brand-word">
        Auto<span className="accent">Care</span>
      </span></>}
    </Link>
  );
}
