import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { QueryProvider } from '@/components/layout/query-provider'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { TopNavbar } from '@/components/layout/top-navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CollectIQ — AI-Powered Accounts Receivable',
  description: 'AI-powered accounts receivable operations platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <QueryProvider>
            <div className="flex h-screen overflow-hidden bg-background">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <TopNavbar />
                <main className="flex-1 overflow-y-auto p-6">
                  {children}
                </main>
              </div>
            </div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
