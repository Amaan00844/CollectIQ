'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchCustomers, fetchInvoices, fetchPolicy, fetchReplay, fetchRisk } from '@/lib/api'

export function useLiveInvoices() {
  return useQuery({ queryKey: ['invoices'], queryFn: fetchInvoices })
}

export function useLiveCustomers() {
  return useQuery({ queryKey: ['customers'], queryFn: fetchCustomers })
}

export function useLiveRisk() {
  return useQuery({ queryKey: ['risk'], queryFn: fetchRisk })
}

export function useLiveReplay() {
  return useQuery({ queryKey: ['replay'], queryFn: fetchReplay })
}

export function useLivePolicy() {
  return useQuery({ queryKey: ['policy'], queryFn: fetchPolicy })
}
