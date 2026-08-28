'use client'

import { PageHeader } from '@/components/shared/page-header'
import { Bot, Shield, Brain, GitBranch, Check } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <PageHeader title="Settings" description="Agent configuration and API connections." />

      {/* LLM Config */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Brain className="w-4 h-4" />
          <h2 className="text-sm font-semibold text-foreground">LLM Configuration</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground">Provider</label>
            <div className="mt-1 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm text-foreground">NVIDIA NIM (OpenAI-compatible)</div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Model</label>
            <div className="mt-1 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm text-foreground font-mono">google/diffusiongemma-26b-a4b-it</div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Base URL</label>
            <div className="mt-1 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm text-foreground font-mono">https://integrate.api.nvidia.com/v1</div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">API Key</label>
            <div className="mt-1 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm text-foreground font-mono">nvapi-••••••••••••••••</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="w-3.5 h-3.5" /> Connected · Rule-based fallback enabled
          </div>
        </div>
      </div>

      {/* Agent Scope */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Bot className="w-4 h-4" />
          <h2 className="text-sm font-semibold text-foreground">Agent Scope</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          {[
            { label: 'Auto-send first 3 customer reminders', enabled: true },
            { label: 'Classify inbound emails with LLM', enabled: true },
            { label: 'Pause collection on dispute', enabled: true },
            { label: 'Hold all escalations for human review', enabled: true },
            { label: 'Hold high-amount (>₹3L) for human review', enabled: true },
            { label: 'Send CEO/Owner notices automatically', enabled: false },
            { label: 'Legal notice generation', enabled: false },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{item.label}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${item.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-muted text-muted-foreground border-border'}`}>
                {item.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Policy file */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <GitBranch className="w-4 h-4" />
          <h2 className="text-sm font-semibold text-foreground">Policy File</h2>
          <span className="ml-auto font-mono text-xs text-muted-foreground">config/policy.yaml</span>
        </div>
        <div className="px-5 py-4 text-xs text-muted-foreground">
          All escalation thresholds and timing are in <code className="font-mono bg-muted px-1 py-0.5 rounded">config/policy.yaml</code>. No code changes needed — edit the YAML and restart the agent. See the <a href="/policy" className="text-primary hover:underline">Policy page</a> for a visual view.
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <h2 className="text-sm font-semibold text-foreground">Safety Invariants</h2>
        </div>
        <div className="px-5 py-4 space-y-2 text-xs text-muted-foreground">
          {[
            'Point-in-time filtering: only data known at decision time is used',
            'All LLM output validated with Pydantic before affecting any decision',
            'Invoice references validated against known invoice set — hallucinations blocked',
            'Disputes immediately halt all automated collection',
            'No auto-send above ₹3,00,000 — always requires human sign-off',
          ].map((inv, i) => (
            <div key={i} className="flex items-start gap-2">
              <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
              {inv}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
