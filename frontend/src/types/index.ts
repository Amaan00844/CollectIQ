export interface Invoice {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  issuedDate: string;
  dueDate: string;
  status: 'paid' | 'open' | 'due_soon' | 'overdue' | 'disputed' | 'promise_to_pay';
  daysOverdue: number;
  amountOutstanding: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  riskReasons: string[];
  description: string;
  nextAction?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  industry: string;
  totalOutstanding: number;
  totalOverdue: number;
  avgPaymentDelayDays: number;
  latePaymentRate: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lastActivity: string;
  invoiceCount: number;
}

export interface AgentAction {
  id: string;
  date: string;
  invoiceId: string;
  customerId: string;
  customerName: string;
  recipientTier: string;
  action: string;
  messageBody: string;
  deliveryMode: 'auto_send' | 'human_signoff';
  reason: string;
  policyRule: string;
  riskLevel: string;
  riskScore: number;
  daysOverdue: number;
  amountOutstanding: number;
  status: 'auto_sent' | 'awaiting_review' | 'approved' | 'rejected';
  emailIntent?: string;
}

export interface RiskReport {
  invoiceId: string;
  customerId: string;
  customerName: string;
  amount: number;
  amountOutstanding: number;
  dueDate: string;
  daysOverdue: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  reasons: string[];
  features: Record<string, number>;
}

export interface ReplayEvent {
  id: string;
  date: string;
  invoiceId: string;
  customerName: string;
  action: string;
  recipientTier: string;
  deliveryMode: 'auto_send' | 'human_signoff';
  reason: string;
  policyRule: string;
  riskLevel: string;
  riskScore: number;
  daysOverdue: number;
  amountOutstanding: number;
  messageBody: string;
}

export interface Policy {
  reminders: {
    first_reminder: PolicyStage;
    second_reminder: PolicyStage;
    third_reminder: PolicyStage;
  };
  escalation: {
    sales: PolicyStage;
    controller: PolicyStage;
    ceo: PolicyStage;
    owner: PolicyStage;
  };
  human_review: {
    triggers: string[];
    high_amount_threshold: number;
    low_confidence_threshold: number;
  };
}

export interface PolicyStage {
  overdue_days: number;
  recipient_tier: string;
  mode: 'auto_send' | 'human_signoff';
  frequency_days?: number | null;
}

export interface KpiMetric {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
}
