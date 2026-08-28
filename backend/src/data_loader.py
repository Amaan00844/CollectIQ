"""
Data loader for CollectIQ collections pack.
Loads CSV files, validates schema, parses dates, returns typed collections.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Optional

import pandas as pd

from src.models import Customer, Invoice, Payment, Email

DATA_DIR = Path(__file__).parent.parent / "data"


def _load_csv(filename: str) -> pd.DataFrame:
    path = DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Data file not found: {path}")
    df = pd.read_csv(path, dtype=str)
    df = df.where(pd.notna(df), None)
    return df


def load_customers() -> dict[str, Customer]:
    df = _load_csv("customers.csv")
    contacts = _load_csv("contacts.csv") if (DATA_DIR / "contacts.csv").exists() else None
    customers: dict[str, Customer] = {}
    for _, row in df.iterrows():
        customer_contacts = contacts[contacts["customer_id"] == row["customer_id"]] if contacts is not None else None

        def contact_email(contact_type: str, side: str = "customer") -> str:
            if customer_contacts is None:
                return ""
            matches = customer_contacts[
                (customer_contacts["contact_type"] == contact_type)
                & (customer_contacts["side"] == side)
            ]
            return str(matches.iloc[0]["email"]) if not matches.empty else ""

        terms = row.get("payment_terms_days")
        if not terms:
            terms_match = re.search(r"(\d+)", str(row.get("payment_terms") or ""))
            terms = terms_match.group(1) if terms_match else "0"
        c = Customer(
            customer_id=row["customer_id"],
            customer_name=row["customer_name"],
            contact_email=row.get("contact_email") or contact_email("ap_contact"),
            sales_rep=row.get("sales_rep") or contact_email("sales_owner", "provider"),
            controller_email=row.get("controller_email") or contact_email("controller"),
            ceo_email=row.get("ceo_email") or contact_email("ceo"),
            owner_email=row.get("owner_email") or contact_email("owner"),
            industry=row.get("industry") or "",
            payment_terms_days=int(terms),
        )
        customers[c.customer_id] = c
    return customers


def load_invoices() -> dict[str, Invoice]:
    df = _load_csv("invoices.csv")
    invoices: dict[str, Invoice] = {}
    for _, row in df.iterrows():
        inv = Invoice(
            invoice_id=row["invoice_id"],
            customer_id=row["customer_id"],
            amount=float(row["amount"]),
            currency=row.get("currency") or "USD",
            issue_date=row["issue_date"],
            due_date=row["due_date"],
            description=row.get("description") or "",
        )
        invoices[inv.invoice_id] = inv
    return invoices


def load_payments() -> list[Payment]:
    df = _load_csv("payments.csv")
    payments: list[Payment] = []
    for _, row in df.iterrows():
        p = Payment(
                payment_id=row.get("payment_id") or f"PAY-{len(payments) + 1:04d}",
                invoice_id=row["invoice_id"],
            amount_paid=float(row.get("amount_paid") or row["amount"]),
            payment_date=row["payment_date"],
            payment_method=row.get("payment_method") or row.get("method") or "",
            reference=row.get("reference") or "",
        )
        payments.append(p)
    return payments


def load_emails() -> list[Email]:
    emails: list[Email] = []
    replies_dir = DATA_DIR / "inbound_replies"
    contact_owners: dict[str, str] = {}
    contacts_path = DATA_DIR / "contacts.csv"
    if contacts_path.exists():
        contacts_df = _load_csv("contacts.csv")
        contact_owners = dict(zip(contacts_df["email"], contacts_df["customer_id"]))
    invoice_owners = {invoice.invoice_id: invoice.customer_id for invoice in load_invoices().values()}
    for reply_path in sorted(replies_dir.glob("*.txt")):
        body = reply_path.read_text(encoding="utf-8")
        headers, _, message = body.partition("\n\n")
        header_values = {
            key.lower(): value.strip()
            for key, value in (line.split(":", 1) for line in headers.splitlines() if ":" in line)
        }
        invoice_match = re.search(r"\bINV-\d+\b", f"{header_values.get('subject', '')} {message}")
        sender = header_values.get("from", "")
        customer_id = contact_owners.get(sender, "")
        if not customer_id and invoice_match:
            customer_id = invoice_owners.get(invoice_match.group(0), "")
        emails.append(Email(
            email_id=reply_path.stem,
            customer_id=customer_id,
            from_email=sender,
            subject=header_values.get("subject", ""),
            body=message.strip(),
            received_date=header_values.get("date", ""),
            invoice_ref=invoice_match.group(0) if invoice_match else None,
        ))
    return emails


class CollectionsData:
    """
    Central holder for all collections data. Provides point-in-time filtering.
    """

    def __init__(self) -> None:
        self.customers = load_customers()
        self.invoices = load_invoices()
        self.payments = load_payments()
        self.emails = load_emails()

    def invoices_known_at(self, as_of: "date") -> dict[str, Invoice]:  # type: ignore[name-defined]
        """Return only invoices issued on or before as_of."""
        from datetime import date as dt
        return {
            k: v for k, v in self.invoices.items()
            if v.issue_date <= (as_of if isinstance(as_of, dt) else dt.fromisoformat(str(as_of)))
        }

    def payments_known_at(self, as_of: "date") -> list[Payment]:  # type: ignore[name-defined]
        """Return only payments received on or before as_of."""
        from datetime import date as dt
        cutoff = as_of if isinstance(as_of, dt) else dt.fromisoformat(str(as_of))
        return [p for p in self.payments if p.payment_date <= cutoff]

    def emails_known_at(self, as_of: "date") -> list[Email]:  # type: ignore[name-defined]
        """Return only emails received on or before as_of."""
        from datetime import date as dt
        cutoff = as_of if isinstance(as_of, dt) else dt.fromisoformat(str(as_of))
        return [e for e in self.emails if e.received_date <= cutoff]

    def get_invoice_payments(self, invoice_id: str, as_of: "date") -> list[Payment]:  # type: ignore[name-defined]
        return [p for p in self.payments_known_at(as_of) if p.invoice_id == invoice_id]

    def get_customer_emails(self, customer_id: str, as_of: "date") -> list[Email]:  # type: ignore[name-defined]
        return [e for e in self.emails_known_at(as_of) if e.customer_id == customer_id]
