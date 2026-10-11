import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Activity, ArrowDown, ArrowRight, ArrowUpRight, Box, Braces, Check, ChevronRight, CircleCheck, Cpu, FileCode2, Fingerprint, Globe, LockKeyhole, Play, Shield, ShieldCheck, Terminal, UserCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/site-header';
import heroImage from '@/assets/sandbox-hero.jpg';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'Aegis Agent Harness — Runtime Governance for Autonomous AI' },
    { name: 'description', content: 'Deterministic runtime safety for autonomous AI agents. Sandbox isolation, human approvals, SSRF protection, and full trace telemetry.' },
    { property: 'og:title', content: 'Aegis Agent Harness — Autonomous AI, under control' },
    { property: 'og:description', content: 'Runtime governance, sandboxed tools, human approval gates, and live agent observability.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }), component: Home,
});
const features = [
  { icon: Box, title: 'Sandbox Isolation', description: 'Deterministic containment. No path traversal. No root boundary escapes.', color: 'text-primary', label: 'FILESYSTEM BOUNDARY', example: '/workspace/../etc/passwd', outcome: 'BOUNDARY VIOLATION', detail: 'Tool paths are evaluated against the sandbox root before execution. Requests outside the approved boundary are denied.', badge: 'Blocked', danger: true },
  { icon: UserCheck, title: 'Human-in-the-Loop Governance', description: 'Your agent can propose. Only you can authorize sensitive writes and deletions.', color: 'text-info', label: 'AUTHORIZATION GATE', example: 'filesystem.write("config.yaml")', outcome: 'OPERATOR APPROVAL REQUIRED', detail: 'Sensitive filesystem mutations pause the run. Review the tool, target, and content before approving or denying execution.', badge: 'Pending', danger: false },
  { icon: Globe, title: 'Egress & SSRF Firewall', description: 'Real-time IP filtering. Cloud metadata and internal subnets stay out of reach.', color: 'text-violet', label: 'OUTBOUND REQUEST', example: 'GET 169.254.169.254/latest/meta-data', outcome: 'PRIVATE DESTINATION DENIED', detail: 'Egress policy gates evaluate outbound destinations and deny access to internal networks and cloud metadata endpoints.', badge: 'Blocked', danger: true },
  { icon: Activity, title: 'Live Telemetry & Tracing', description: 'Every step accounted for. Microsecond latency, circuit breakers, and token costs.', color: 'text-warning', label: 'EXECUTION TRACE', example: 'tool.call → policy.check → result', outcome: 'FULL EXECUTION VISIBILITY', detail: 'Follow tool calls, execution durations, token usage, policy decisions, and the step circuit breaker in the live console.', badge: 'Traced', danger: false },
];
const stages = [
  { icon: Terminal, title: 'User Instruction', sub: 'Intent received', detail: 'The operator provides the agent with a task. The instruction enters the governed runtime.' },
  { icon: ShieldCheck, title: 'Guardrail & Circuit Breaker', sub: 'Bound the execution', detail: 'Guardrails and a step circuit breaker constrain execution before it can become a runaway loop.' },
  { icon: Cpu, title: 'LLM Reasoning', sub: 'Plan the next action', detail: 'The language model selects the next action. Proposed tools are not executed until their policy checks pass.' },
  { icon: LockKeyhole, title: 'Sandbox Policy Gate', sub: 'Validate permissions', detail: 'The policy gate evaluates filesystem boundaries and network destinations before allowing the proposed tool call.' },
  { icon: UserCheck, title: 'Human Approval', sub: 'Authorize mutations', detail: 'Sensitive writes and deletions require explicit operator authorization. Denied requests never reach tool execution.' },
  { icon: Zap, title: 'Tool Execution', sub: 'Execute & trace', detail: 'Approved tool calls execute and return their results. Every event is recorded in the live execution trace.' },
];
function Home() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [stage, setStage] = useState(3);
  const [policy, setPolicy] = useState(false);
  const scroll = () => document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' });
  return <div className="landing min-h-screen bg-background text-foreground"><SiteHeader/>
    <main>
      <section className="hero relative isolate overflow-hidden border-b border-border">
        <img src={heroImage} alt="A protected agent core within a transparent sandbox containment boundary" width={1536} height={1024} className="hero-image absolute inset-0 -z-20 h-full w-full object-cover"/>
        <div className="hero-shade absolute inset-0 -z-10"/>
        <div className="page-width relative pt-16 text-center md:pt-[70px]">
          <div className="eyebrow mx-auto inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1.5 text-[10px] text-muted-foreground sm:text-[11px]"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"/><span><span className="text-primary">v2.4</span> Production Safety Standard <span className="mx-1.5 text-border">·</span> OWASP Top 10 for LLMs</span><ChevronRight size={12} className="shrink-0"/></div>
          <h1 className="mx-auto mt-6 max-w-[950px] text-[36px] font-medium leading-[1.1] md:text-[58px]">Runtime Governance &amp; Sandboxing<br className="hidden lg:block"/> for Autonomous <span className="text-primary">AI Agents</span></h1>
          <p className="mx-auto mt-5 max-w-[690px] text-[13px] leading-6 text-muted-foreground md:text-[15px]">Protect against prompt injection, unauthorized filesystem mutations, and egress SSRF with deterministic safety gates, human-in-the-loop approvals, and full trace telemetry.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><Button asChild className="h-11 gap-7 px-5 shadow-glow"><Link to="/console"><Terminal size={15}/>Launch Console<ArrowUpRight size={15}/></Link></Button><Button onClick={scroll} variant="outline" className="h-11 bg-background/60 px-4 text-xs">View Architecture &amp; Policy Specs<ArrowDown size={14}/></Button></div>
          <div className="mt-4 flex justify-center gap-5 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><Check size={11} className="text-primary"/>No login required</span><span className="flex items-center gap-1.5"><Check size={11} className="text-primary"/>Your runtime. Your control.</span></div>
        </div>
        <div className="hero-annotations page-width absolute inset-x-0 bottom-[100px] flex items-end justify-between text-[10px] font-mono">
          <div className="annotation"><div className="mb-3 flex items-center gap-2 text-primary"><ShieldCheck size={13}/>POLICY ENFORCED</div><div className="text-muted-foreground">sandbox.root <span className="ml-3 text-foreground">/workspace</span></div><div className="mt-1.5 text-muted-foreground">boundary.escape <span className="ml-3 text-primary">DENIED</span></div></div>
          <div className="annotation"><div className="mb-3 flex items-center gap-2 text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary"/>DETERMINISTIC SAFETY</div><div className="text-muted-foreground">Every action checked.<br/><span className="inline-block mt-1.5">Every decision traced.</span></div></div>
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-border/70 bg-background/60"><div className="page-width flex min-h-14 flex-wrap items-center justify-center gap-x-10 gap-y-3 py-4 text-[10px] text-muted-foreground md:justify-between"><span className="font-mono">BUILT FOR AGENTS. DESIGNED FOR TRUST.</span><span className="flex items-center gap-2"><Shield size={13}/>OWASP-aligned guardrails</span><span className="flex items-center gap-2"><Fingerprint size={13}/>Human-authorized execution</span><span className="flex items-center gap-2"><Braces size={13}/>Full-fidelity traces</span></div></div>
      </section>
      <section id="runtime-safety" className="page-width scroll-mt-24 py-16 md:py-20">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-4"><div><div className="section-eyebrow"><span className="text-primary">01 /</span> THE SAFETY LAYER</div><h2 className="mt-3 text-[28px] font-medium md:text-[32px]">Autonomy without the exposure.</h2></div><p className="max-w-[330px] text-xs leading-5 text-muted-foreground">Four layers of deterministic protection.<br/>One governed execution environment.</p></div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{features.map((f, i) => <article key={f.title} className={cn('feature-card group flex flex-col rounded-lg border border-border bg-card/60 p-5 transition-all hover:border-primary/35', expanded === i && 'border-primary/40')}>
          <div className="flex items-center justify-between"><f.icon size={21} strokeWidth={1.5} className={f.color}/><span className="font-mono text-[10px] text-muted-foreground">0{i+1}</span></div>
          <h3 className="mt-6 min-h-12 text-[15px] font-medium leading-6">{f.title}</h3><p className="mt-2 min-h-[68px] text-xs leading-[1.7] text-muted-foreground">{f.description}</p>
          <div className="feature-terminal mt-5 min-h-[100px] border-y border-border/70 py-3 font-mono"><div className="text-[8px] text-muted-foreground">{f.label}</div><div className="mt-2 break-all text-[9px] text-foreground/80">{f.example}</div><div className={cn('mt-3 flex items-center gap-1.5 text-[8px]', f.danger ? 'text-destructive' : f.color)}><span className="h-1 w-1 rounded-full bg-current"/>{f.outcome}</div></div>
          {expanded === i && <p className="mt-4 text-xs leading-5 text-muted-foreground">{f.detail}</p>}
          <Button variant="unstyled" size="none" aria-expanded={expanded === i} onClick={() => setExpanded(expanded === i ? null : i)} className="mt-4 justify-between text-[10px] text-muted-foreground">{expanded === i ? 'Close details' : 'Explore protection'}<ArrowUpRight size={12}/></Button>
        </article>)}</div>
      </section>
      <section id="architecture" className="scroll-mt-20 border-y border-border bg-surface/40 py-16 md:py-20"><div className="page-width"><div className="flex flex-wrap items-end justify-between gap-4"><div><div className="section-eyebrow"><span className="text-primary">02 /</span> GOVERNED BY DESIGN</div><h2 className="mt-3 text-[28px] font-medium md:text-[32px]">A clear path. No unchecked actions.</h2></div><Button variant="outline" size="sm" onClick={() => setPolicy(!policy)}><FileCode2 size={13}/>{policy ? 'Execution flow' : 'Policy specs'}</Button></div>
        <p className="mt-3 text-xs text-muted-foreground">From instruction to execution, safety is part of the runtime—not an afterthought.</p>
        {!policy ? <><div className="flow-grid mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">{stages.map((s,i) => <div key={s.title} className="relative"><Button variant="unstyled" size="none" onClick={() => setStage(i)} aria-pressed={stage === i} className={cn('flow-node relative flex h-[132px] w-full flex-col items-start justify-start gap-0 whitespace-normal rounded-md border border-border bg-background p-4 text-left hover:border-primary/50',stage === i && 'border-primary/60 bg-primary/5')}><div className="flex w-full items-center justify-between"><s.icon size={18} className={stage === i ? 'text-primary' : 'text-muted-foreground'}/><span className="font-mono text-[8px] text-muted-foreground">0{i+1}</span></div><div className="mt-4 text-xs font-medium">{s.title}</div><div className="mt-1 text-[9px] text-muted-foreground">{s.sub}</div></Button>{i<5 && <ArrowRight className="flow-arrow absolute -right-3 top-[58px] z-10 h-3 w-3 bg-surface text-muted-foreground"/>}</div>)}</div><div className="mt-5 flex min-h-16 items-start gap-3 border-l-2 border-primary pl-4"><CircleCheck size={15} className="mt-0.5 shrink-0 text-primary"/><div><p className="text-xs font-medium">{stages[stage]?.title}</p><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{stages[stage]?.detail}</p></div></div></> : <div className="mt-8 overflow-x-auto rounded-md border border-border bg-background p-6"><pre className="font-mono text-xs leading-7 text-muted-foreground"><span className="text-primary">{'# Aegis runtime policy\n'}</span>{'filesystem:\n  boundary: sandbox root\n  traversal: deny\n  writes_and_deletes: human approval\negress:\n  cloud_metadata: deny\n  internal_subnets: deny\nexecution:\n  circuit_breaker: runtime step limit\n  telemetry: all tool and policy events'}</pre></div>}
      </div></section>
      <section className="page-width flex flex-wrap items-center justify-between gap-6 py-16"><div className="flex items-center gap-5"><div className="flex h-12 w-12 items-center justify-center rounded-md border border-primary/25 bg-primary/5 text-primary"><Terminal size={22}/></div><div><h2 className="text-2xl font-medium">Put your agents under control.</h2><p className="mt-2 text-xs text-muted-foreground">Open the console. Inspect the runtime. Own every decision.</p></div></div><Button asChild className="h-11 gap-8"><Link to="/console">Launch Console<ArrowRight size={16}/></Link></Button></section>
    </main>
    <footer className="border-t border-border"><div className="page-width flex flex-wrap items-center justify-between gap-3 py-6 text-[10px] text-muted-foreground"><span className="flex items-center gap-2"><Shield size={14} className="text-primary"/><span className="font-semibold text-foreground">aegis</span><span className="ml-3">Agent Harness / v2.4</span></span><span>Deterministic safety for autonomous systems.</span><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary"/>Governed by design</span></div></footer>
  </div>;
}
