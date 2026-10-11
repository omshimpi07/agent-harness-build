import { Link, useRouterState } from '@tanstack/react-router';
import { ArrowUpRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SiteHeader() {
  const path = useRouterState({ select: s => s.location.pathname });
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return <header className="site-header border-b border-border bg-background/90 backdrop-blur-xl">
    <div className="page-width flex h-[72px] items-center justify-between gap-4">
      <Link to="/" className="flex items-center gap-2.5" aria-label="Aegis Agent Harness home"><span className="brand-mark"><Shield size={19} strokeWidth={1.7} /></span><span className="text-xl font-semibold">aegis<span className="ml-2 hidden text-[11px] font-normal text-muted-foreground sm:inline">AGENT HARNESS</span></span></Link>
      <nav aria-label="Main navigation" className="hidden items-center gap-7 text-[12px] text-muted-foreground md:flex"><Button variant="unstyled" size="none" onClick={() => scrollTo('runtime-safety')}>Runtime safety</Button><Button variant="unstyled" size="none" onClick={() => scrollTo('architecture')}>Architecture</Button><Link to="/console" className={path === '/console' ? 'text-primary' : 'hover:text-foreground'}>Operations console</Link></nav>
      <Button asChild variant="outline" size="sm" className="gap-3 border-border bg-secondary/50"><Link to="/console">Launch Console<ArrowUpRight size={14}/></Link></Button>
    </div>
  </header>;
}
