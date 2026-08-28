"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, ApiCustomerDetail } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";

const money = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<ApiCustomerDetail | null>(null);
  useEffect(() => {
    api
      .customer(customerId)
      .then(setCustomer)
      .catch(() => setCustomer(null));
  }, [customerId]);
  if (!customer)
    return (
      <div className="py-16 text-center text-muted-foreground">
        Loading customer...
      </div>
    );
  return (
    <div className="max-w-4xl space-y-5 animate-fade-in">
      <Link
        href="/customers"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>
      <PageHeader
        title={customer.customer_name}
        description={`${customer.industry} · ${customer.contact_email}`}
      />
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-4">
        <div>
          <div className="text-xs text-muted-foreground">Outstanding</div>
          <div className="font-semibold">
            {money(customer.total_outstanding)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Payment terms</div>
          <div className="font-semibold">
            {customer.payment_terms_days} days
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Open invoices</div>
          <div className="font-semibold">{customer.open_invoices}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Total invoices</div>
          <div className="font-semibold">{customer.invoice_count}</div>
        </div>
      </div>
      <section className="rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
          Invoices ({customer.invoices.length})
        </h2>
        <div className="divide-y divide-border">
          {customer.invoices.map((invoice) => (
            <Link
              key={invoice.invoice_id}
              href={`/invoices/${invoice.invoice_id}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-muted/20"
            >
              <span>
                <span className="font-mono text-sm text-primary">
                  {invoice.invoice_id}
                </span>
                <span className="ml-3 text-sm">{invoice.description}</span>
              </span>
              <span className="text-sm font-medium">
                {money(invoice.amount)}
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
          Inbound emails ({customer.emails.length})
        </h2>
        <div className="divide-y divide-border">
          {customer.emails.map((email) => (
            <div
              key={email.email_id}
              className="flex justify-between px-5 py-3 text-sm"
            >
              <span>{email.subject}</span>
              <span className="text-muted-foreground">
                {email.received_date}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
