import React from 'react'
import {NavigationProvider, type NavigationContextValue} from '../shared/navigation'
import {useAppNavigate} from '../shared/navigation'
import {useGeolocation} from '../shared/hooks/use-geolocation'

interface AppWrapperProps {
  nav: NavigationContextValue
  children: React.ReactNode
}

export function AppWrapper({nav, children}: AppWrapperProps) {
  useGeolocation()

  return (
    <NavigationProvider value={nav}>
      <div className="dark">
        <div className="jaen-app flex flex-col">
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </div>
    </NavigationProvider>
  )
}

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { path: '/transfers', label: 'Transfers', icon: IconArrowLeftRight },
  { path: '/booking', label: 'Booking', icon: IconCalendarCheck },
  { path: '/users', label: 'Users', icon: IconUsers },
  { path: '/locations', label: 'Locations', icon: IconMapPin },
]

function MobileBottomNav() {
  const navigate = useAppNavigate()
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''

  const isActive = (path: string) => {
    const full = `/app${path}`
    return currentPath === full || currentPath.startsWith(`${full}/`)
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card flex items-center justify-around h-14">
      {NAV_ITEMS.map(item => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs transition-colors ${
            isActive(item.path) ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

function IconLayoutDashboard({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  )
}

function IconArrowLeftRight({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" />
    </svg>
  )
}

function IconCalendarCheck({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="m9 16 2 2 4-4" />
    </svg>
  )
}

function IconUsers({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconMapPin({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}
