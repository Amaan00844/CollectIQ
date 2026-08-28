import type { AgentAction, Customer, Invoice, Policy, ReplayEvent, RiskReport } from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type ApiInvoice = {
  invoice_id: string
  customer_id: string
  customer_name: string
  amount: number
  currency: string
  issue_date: string
  due_date: string
  description: string
  status: string
  amount_outstanding: number
  days_overdue: number
}

type ApiRisk = {
  invoice_id: string
  customer_id: string
  customer_name: string
  amount: number
  amount_outstanding: number
  due_date: string
  days_overdue: number
  risk_level: RiskReport['riskLevel']
  risk_score: number
  reasons: string[]
  features: Record<string, number>
}

type ApiAction = Record<string, unknown> & {
  invoice_id: string
  customer_id?: string
  customer_name: string
  date: string
  action: string
  recipient_tier: string
  delivery_mode: AgentAction['deliveryMode']
  reason: string
  policy_rule: string
  risk_level: string
  risk_score: number
  days_overdue: number
  amount_outstanding: number
  message_body: string
  email_intent?: string
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`API request failed (${response.status}): ${path}`)
  return response.json() as Promise<T>
}

function normalizeStatus(status: string): Invoice['status'] {
  if (status === 'partial') return 'open'
  if (status === 'paid' || status === 'open' || status === 'overdue') return status
  return 'open'
}

function normalizeInvoice(invoice: ApiInvoice, risk?: RiskReport): Invoice {
  return {
    id: invoice.invoice_id,
    customerId: invoice.customer_id,
    customerName: invoice.customer_name,
    amount: invoice.amount,
    currency: invoice.currency,
    issuedDate: invoice.issue_date,
    dueDate: invoice.due_date,
    status: normalizeStatus(invoice.status),
    daysOverdue: invoice.days_overdue,
    amountOutstanding: invoice.amount_outstanding,
    risk: risk?.riskLevel || 'LOW',
    riskScore: risk?.riskScore || 0,
    riskReasons: risk?.reasons || [],
    description: invoice.description,
  }
}

function normalizeRisk(risk: ApiRisk): RiskReport {
  return {
    invoiceId: risk.invoice_id,
    customerId: risk.customer_id,
    customerName: risk.customer_name,
    amount: risk.amount,
    amountOutstanding: risk.amount_outstanding,
    dueDate: risk.due_date,
    daysOverdue: risk.days_overdue,
    riskLevel: risk.risk_level,
    riskScore: risk.risk_score,
    reasons: risk.reasons,
    features: risk.features,
  }
}

function normalizeAction(action: ApiAction, index: number): AgentAction & ReplayEvent {
  return {
    id: String(action.id || `API-${index + 1}`),
    date: action.date,
    invoiceId: action.invoice_id,
    customerId: String(action.customer_id || ''),
    customerName: action.customer_name,
    recipientTier: action.recipient_tier,
    action: action.action,
    messageBody: action.message_body,
    deliveryMode: action.delivery_mode,
    reason: action.reason,
    policyRule: action.policy_rule,
    riskLevel: action.risk_level,
    riskScore: action.risk_score,
    daysOverdue: action.days_overdue,
    amountOutstanding: action.amount_outstanding,
    status: action.delivery_mode === 'human_signoff' ? 'awaiting_review' : 'auto_sent',
    emailIntent: action.email_intent,
  }
}

export async function fetchRisk(): Promise<RiskReport[]> {
  const data = await request<ApiRisk[]>('/risk')
  return data.map(normalizeRisk)
}

export async function fetchInvoices(): Promise<Invoice[]> {
  const [{ invoices }, risks] = await Promise.all([
    request<{ invoices: ApiInvoice[] }>('/invoices'),
    fetchRisk().catch(() => []),
  ])
  const riskByInvoice = new Map(risks.map(risk => [risk.invoiceId, risk]))
  return invoices.map(invoice => normalizeInvoice(invoice, riskByInvoice.get(invoice.invoice_id)))
}

export async function fetchInvoice(invoiceId: string) {
  const [invoice, risks] = await Promise.all([
    request<ApiInvoice & { payments: unknown[]; emails: unknown[]; actions: ApiAction[] }>(`/invoices/${invoiceId}`),
    fetchRisk().catch(() => []),
  ])
  return { ...normalizeInvoice(invoice, risks.find(risk => risk.invoiceId === invoiceId)), payments: invoice.payments, emails: invoice.emails, actions: invoice.actions.map((action, index) => normalizeAction(action, index)) }
}

export async function fetchCustomers(): Promise<Customer[]> {
  const { customers } = await request<{ customers: Array<Record<string, any>> }>('/customers')
  return customers.map(customer => ({
    id: customer.customer_id,
    name: customer.customer_name,
    email: customer.contact_email,
    industry: customer.industry,
    totalOutstanding: customer.total_outstanding,
    totalOverdue: customer.total_outstanding,
    avgPaymentDelayDays: 0,
    latePaymentRate: 0,
    risk: customer.total_outstanding > 0 ? 'HIGH' : 'LOW',
    lastActivity: '',
    invoiceCount: customer.open_invoices,
  }))
}

export async function fetchCustomer(customerId: string) {
  return request<Record<string, any>>(`/customers/${customerId}`)
}

export async function fetchReplay(): Promise<(AgentAction & ReplayEvent)[]> {
  const { actions } = await request<{ actions: ApiAction[] }>('/replay')
  return actions.map(normalizeAction)
}

export async function fetchPolicy(): Promise<Policy> {
  return request<Policy>('/policy')
}
