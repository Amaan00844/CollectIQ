import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchInvoice } from "@/lib/api";
import {
  StatusBadge,
  RiskBadge,
  DeliveryModeBadge,
} from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { formatINRFull, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  AlertTriangle,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  let invoice;
  try {
    invoice = await fetchInvoice(invoiceId);
  } catch {
    return notFound();
  }
  const relatedActions = invoice.actions;

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link
          href="/invoices"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Invoices
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-mono text-sm font-semibold text-foreground">
          {invoice.id}
        </span>
      </div>

      {/* Header card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-xs text-muted-foreground mb-1">
              {invoice.id}
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {invoice.customerName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {invoice.description}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <StatusBadge status={invoice.status} />
            <RiskBadge risk={invoice.risk} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              Invoice Amount
            </div>
            <div className="text-base font-bold text-foreground mt-1">
              {formatINRFull(invoice.amount)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              Outstanding
            </div>
            <div
              className={`text-base font-bold mt-1 ${invoice.amountOutstanding > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600"}`}
            >
              {formatINRFull(invoice.amountOutstanding)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              Due Date
            </div>
            <div className="text-base font-bold text-foreground mt-1">
              {formatDate(invoice.dueDate)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              Days Overdue
            </div>
            <div
              className={`text-base font-bold mt-1 ${invoice.daysOverdue > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600"}`}
            >
              {invoice.daysOverdue > 0
                ? `${invoice.daysOverdue} days`
                : "On time"}
            </div>
          </div>
        </div>
      </div>

      {/* Risk analysis */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Risk Analysis
          </h2>
          <span className="ml-auto text-2xl font-bold text-foreground">
            {invoice.riskScore}
            <span className="text-sm font-normal text-muted-foreground">
              /100
            </span>
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full mb-4">
          <div
            className={`h-2 rounded-full transition-all ${invoice.riskScore >= 85 ? "bg-purple-500" : invoice.riskScore >= 70 ? "bg-red-500" : invoice.riskScore >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${invoice.riskScore}%` }}
          />
        </div>
        <ul className="space-y-2">
          {invoice.riskReasons.map((reason, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-foreground"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              {reason}
            </li>
          ))}
        </ul>
      </div>

      {/* Collection history */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Collection Actions
          </h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {relatedActions.length} action
            {relatedActions.length !== 1 ? "s" : ""}
          </span>
        </div>
        {relatedActions.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No collection actions for this invoice yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {relatedActions.map((action) => (
              <div key={action.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <DeliveryModeBadge mode={action.deliveryMode} />
                  <span className="text-sm font-medium text-foreground capitalize">
                    {action.action.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDate(action.date)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {action.reason}
                </div>
                {action.messageBody && (
                  <div className="mt-2 text-xs text-foreground bg-muted/40 rounded-md p-3 font-mono whitespace-pre-wrap leading-relaxed">
                    {action.messageBody}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
