"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, ApiInvoiceDetail } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";

const money = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<ApiInvoiceDetail | null>(null);
  useEffect(() => {
    api
      .invoice(invoiceId)
      .then(setInvoice)
      .catch(() => setInvoice(null));
  }, [invoiceId]);
  if (!invoice)
    return (
      <div className="py-16 text-center text-muted-foreground">
        Loading invoice...
      </div>
    );
  return (
    <div className="max-w-4xl space-y-5 animate-fade-in">
      <Link
        href="/invoices"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>
      <PageHeader
        title={invoice.invoice_id}
        description={invoice.description}
      />
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-4">
        <div>
          <div className="text-xs text-muted-foreground">Customer</div>
          <div className="font-semibold">{invoice.customer_id}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="font-semibold capitalize">{invoice.status}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Amount</div>
          <div className="font-semibold">{money(invoice.amount)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Outstanding</div>
          <div className="font-semibold">
            {money(invoice.amount_outstanding)}
          </div>
        </div>
      </div>
      <section className="rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
          Payments ({invoice.payments.length})
        </h2>
        <div className="divide-y divide-border">
          {invoice.payments.map((payment, index) => (
            <div
              key={`${payment.date}-${index}`}
              className="flex justify-between px-5 py-3 text-sm"
            >
              <span>
                {payment.method} · {payment.reference}
              </span>
              <span>
                {payment.date} · {money(payment.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
          Inbound emails ({invoice.emails.length})
        </h2>
        <div className="divide-y divide-border">
          {invoice.emails.map((email) => (
            <div key={email.email_id} className="px-5 py-3 text-sm">
              <div className="font-medium">{email.subject}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {email.received_date}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                {email.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
