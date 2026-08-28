'use client'

import { Bell, Sun, Moon, Search } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export function TopNavbar() {
  const { theme, setTheme } = useTheme()

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-card shrink-0">
      {/* Left: search */}
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted/50 text-sm text-muted-foreground w-full">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs">Search invoices, customers...</span>
          <kbd className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded bg-background border border-border">⌘K</kbd>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {/* Agent status */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-medium mr-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Agent Active
        </div>

        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Avatar */}
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
            AR
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-medium text-foreground leading-none">Admin User</div>
            <div className="text-[10px] text-muted-foreground">admin@collectiq.com</div>
          </div>
        </div>
      </div>
    </header>
  )
}
