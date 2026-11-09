import { ArrowUpRight, Bluetooth, MapPinned, Route, Wrench } from 'lucide-react';
import Link from 'next/link';
import { technologyPages } from '@/lib/public-technology';

const icons = {
  'smart-gps': Route,
  bluetooth: Bluetooth,
  'smart-maintenance': Wrench,
  'autocare-maps': MapPinned,
};
export function TechnologyNavigation({ current }: { current?: string }) {
  return (
    <nav className="ac-technology-navigation" aria-label="Tehnologiile AutoCare">
      {(Object.keys(technologyPages) as (keyof typeof technologyPages)[]).map((slug, index) => {
        const page = technologyPages[slug];
        const Icon = icons[slug];
        return (
          <Link key={slug} href={'/' + slug} aria-current={slug === current ? 'page' : undefined}>
            <span className="ac-technology-icon">
              <Icon size={24} strokeWidth={1.5} />
            </span>
            <small>0{index + 1}</small>
            <strong>{page.label}</strong>
            <span>{page.intro}</span>
            <ArrowUpRight className="ac-technology-arrow" size={19} aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}
