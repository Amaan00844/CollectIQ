/**
 * CollectIQ API client.
 * Reads NEXT_PUBLIC_API_URL from env (falls back to localhost:8000).
 */

import type { Policy } from '@/types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

// ── Types mirroring backend responses ──────────────────────────────────────

export interface ApiInvoice {
  invoice_id: string
  customer_id: string
  customer_name: string
  amount: number
  currency: string
  issue_date: string
  due_date: string
  description: string
  status: 'open' | 'overdue' | 'partial' | 'paid'
  total_paid: number
  amount_outstanding: number
  days_overdue: number
}

export interface ApiInvoiceDetail extends ApiInvoice {
  payments: { amount: number; date: string; method: string; reference: string }[]
  emails: { email_id: string; subject: string; body: string; received_date: string; invoice_ref: string | null }[]
  actions: ApiAction[]
}

export interface ApiCustomer {
  customer_id: string
  customer_name: string
  contact_email: string
  industry: string
  payment_terms_days: number
  open_invoices: number
  open_invoice_ids: string[]
  total_outstanding: number
}

export interface ApiCustomerDetail extends ApiCustomer {
  invoice_count: number
  invoices: { invoice_id: string; amount: number; due_date: string; description: string }[]
  emails: { email_id: string; subject: string; received_date: string; invoice_ref: string | null }[]
}

export interface ApiAction {
  date: string
  invoice_id: string
  customer_id: string
  customer_name: string
  recipient_tier: string
  action: string
  message_body: string
  delivery_mode: 'auto_send' | 'human_signoff'
  reason: string
  policy_rule: string
  risk_level: string
  risk_score: number
  days_overdue: number
  amount_outstanding: number
  email_intent: string | null
  promised_payment_date: string | null
}

export interface ApiRiskItem {
  invoice_id: string
  customer_id: string
  customer_name: string
  risk_level: string
  risk_score: number
  reasons: string[]
  features: Record<string, number>
  amount_outstanding?: number
  days_overdue?: number
  due_date?: string
}

export interface ApiEmail {
  email_id: string
  customer_id: string
  from_email: string
  subject: string
  body: string
  received_date: string
  invoice_ref: string | null
}

// ── Fetchers ───────────────────────────────────────────────────────────────

export const api = {
  health: () => get<{ status: string; invoices: number; customers: number }>('/health'),

  invoices: () => get<{ count: number; invoices: ApiInvoice[] }>('/invoices'),
  invoice: (id: string) => get<ApiInvoiceDetail>(`/invoices/${id}`),

  customers: () => get<{ count: number; customers: ApiCustomer[] }>('/customers'),
  customer: (id: string) => get<ApiCustomerDetail>(`/customers/${id}`),

  emails: () => get<{ count: number; emails: ApiEmail[] }>('/emails'),

  replay: (limit = 1000) => get<{ total: number; actions: ApiAction[] }>(`/replay?limit=${limit}`),

  risk: () => get<ApiRiskItem[]>('/risk'),

  policy: () => get<Policy>('/policy'),

  triggerRun: () =>
    fetch(`${BASE}/run`, { method: 'POST' }).then(r => r.json()),
}
