'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useLiveInvoices() {
  return useQuery({ queryKey: ['invoices'], queryFn: () => api.invoices() })
}

export function useLiveCustomers() {
  return useQuery({ queryKey: ['customers'], queryFn: () => api.customers() })
}

export function useLiveRisk() {
  return useQuery({ queryKey: ['risk'], queryFn: () => api.risk() })
}

export function useLiveReplay() {
  return useQuery({ queryKey: ['replay'], queryFn: () => api.replay(1000) })
}

export function useLivePolicy() {
  return useQuery({ queryKey: ['policy'], queryFn: () => api.policy() })
}
