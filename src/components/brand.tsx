'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Settings,CarFront } from 'lucide-react';
import ReferenceArtwork from './reference-artwork';
import type { MouseEventHandler } from 'react';
export function Brand({
  href = '/start',
  onClick,
  official=false,
  reference=false,
  racing=false,
  label="AutoCare · pagina principală",
}: {
  href?: string;
  official?:boolean;
  reference?:boolean;
  racing?:boolean;
  label?:string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link className="brand" href={href} onClick={onClick} aria-label={label}>
      {official ? <><Image src="/brand/autocare-pearl-mark.svg" alt="" width={36} height={36} unoptimized/><span className="brand-word">Auto<span className="accent">Care</span></span></> : racing?<span className="rg-brand-lockup"><CarFront size={40} strokeWidth={1.3}/><span>Auto<span>Care</span><small>Premium</small></span></span>:reference?<ReferenceArtwork name="wordmark" width={174} height={46} alt="AutoCare"/>:<><span className="brandmark">
        <Settings size={26} strokeWidth={2.1} />
      </span>
      <span className="brand-word">
        Auto<span className="accent">Care</span>
      </span></>}
    </Link>
  );
}
