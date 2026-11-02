import type { ReactNode } from 'react';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
export function AppSection({ title, action, onAction, children, className = '' }: { title: string; action?: string; onAction?: () => void; children: ReactNode; className?: string }) {
  return <section className={'app-section ' + className}><header className="app-section-head"><h2>{title}</h2>{action && onAction && <button className="app-text-action" type="button" onClick={onAction}>{action}<ArrowUpRight size={15}/></button>}</header>{children}</section>;
}
export function AppEmpty({ Icon, title, description, action, onAction }: { Icon: LucideIcon; title: string; description: string; action: string; onAction: () => void }) {
  return <div className="app-empty"><span className="app-icon"><Icon size={24}/></span><h2>{title}</h2><p>{description}</p><button className="primary" type="button" onClick={onAction}>{action}<ArrowUpRight size={16}/></button></div>;
}
export function AppStatus({ state, children }: { state: string; children: ReactNode }) {
  return <span className={'app-status app-status-' + state}>{children}</span>;
}
