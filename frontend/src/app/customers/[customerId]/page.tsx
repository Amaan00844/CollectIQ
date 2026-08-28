import { notFound } from "next/navigation";
import Link from "next/link";
import { mockCustomers, mockInvoices, mockActions } from "@/lib/mock-data";
import {
  StatusBadge,
  RiskBadge,
  DeliveryModeBadge,
} from "@/components/shared/badges";
import { formatINRFull, formatDate } from "@/lib/utils";
import { ArrowLeft, TrendingUp, FileText } from "lucide-react";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const customer = mockCustomers.find((c) => c.id === customerId);
  if (!customer) return notFound();
  const invoices = mockInvoices.filter((i) => i.customerId === customer.id);
  const actions = mockActions.filter((a) => a.customerId === customer.id);

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link
          href="/customers"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Customers
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-semibold text-foreground">
          {customer.name}
        </span>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
            {customer.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">
                {customer.name}
              </h1>
              <RiskBadge risk={customer.risk} />
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {customer.industry} · {customer.email}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              Total Outstanding
            </div>
            <div className="text-base font-bold text-foreground mt-1">
              {formatINRFull(customer.totalOutstanding)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              Overdue
            </div>
            <div
              className={`text-base font-bold mt-1 ${customer.totalOverdue > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600"}`}
            >
              {formatINRFull(customer.totalOverdue)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              Late Payment Rate
            </div>
            <div
              className={`text-base font-bold mt-1 ${customer.latePaymentRate >= 60 ? "text-red-600 dark:text-red-400" : customer.latePaymentRate >= 30 ? "text-amber-600" : "text-emerald-600"}`}
            >
              {customer.latePaymentRate}%
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              Avg Payment Delay
            </div>
            <div className="text-base font-bold text-foreground mt-1">
              {customer.avgPaymentDelayDays} days
            </div>
          </div>
        </div>
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <FileText className="w-4 h-4 text-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Open Invoices
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {invoices.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors"
              >
                <span className="font-mono text-xs font-semibold text-primary">
                  {inv.id}
                </span>
                <span className="text-sm text-foreground flex-1">
                  {inv.description}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {formatINRFull(inv.amountOutstanding)}
                </span>
                <StatusBadge status={inv.status} />
                {inv.daysOverdue > 0 && (
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                    {inv.daysOverdue}d OD
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent actions */}
      {actions.length > 0 && (
        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Recent Agent Actions
            </h2>
          </div>
          <div className="divide-y divide-border">
            {actions.slice(0, 5).map((action) => (
              <div
                key={action.id}
                className="flex items-center gap-3 px-5 py-3.5"
              >
                <DeliveryModeBadge mode={action.deliveryMode} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground capitalize">
                    {action.action.replace(/_/g, " ")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {action.invoiceId} · {formatDate(action.date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
