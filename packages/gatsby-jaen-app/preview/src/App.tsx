import React, { useState } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom'
import { NavigationProvider } from '../../shared/navigation'
import { TransfersView } from '../../shared/views/TransfersView'
import { TransferDetailView } from '../../shared/views/TransferDetailView'
import { BookingView } from '../../shared/views/BookingView'
import { BookingDetailView } from '../../shared/views/BookingDetailView'
import { DashboardView } from '../../shared/views/DashboardView'
import { UsersView } from '../../shared/views/UsersView'
import { UserDetailView } from '../../shared/views/UserDetailView'
import { LocationsView } from '../../shared/views/LocationsView'
import { I18nProvider } from '../../shared/i18n'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/* ---------- Inline SVG Icons ---------- */
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

function IconMenu({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  )
}

function IconX({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { to: '/transfers', label: 'Transfers', icon: IconArrowLeftRight },
  { to: '/booking', label: 'Booking', icon: IconCalendarCheck },
  { to: '/users', label: 'Users', icon: IconUsers },
  { to: '/locations', label: 'Locations', icon: IconMapPin },
]

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <I18nProvider code="de-AT">
    <div className="flex h-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card flex-shrink-0">
        <div className="px-4 py-5 border-b border-border">
          <h1 className="text-lg font-bold text-primary">Limosen Preview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">App Preview</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 border-b border-border bg-card">
        <h1 className="text-base font-bold text-primary">Limosen Preview</h1>
        <button
          className="p-2 rounded-md hover:bg-muted"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <IconX className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="md:hidden fixed inset-y-0 left-0 z-50 w-56 bg-card border-r border-border shadow-2xl">
            <div className="px-4 py-5 border-b border-border">
              <h1 className="text-lg font-bold text-primary">Limosen Preview</h1>
            </div>
            <nav className="p-2 space-y-1">
              {NAV_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-14">
        <Routes>
          <Route path="/" element={<Navigate to="/transfers" replace />} />
          <Route path="/dashboard" element={<NavWrap><DashboardView /></NavWrap>} />
          <Route path="/transfers" element={<NavWrap><TransfersView /></NavWrap>} />
          <Route path="/transfers/:transferId" element={<NavWrap><TransferDetailView /></NavWrap>} />
          <Route path="/booking" element={<NavWrap><BookingView /></NavWrap>} />
          <Route path="/booking/:bookingId" element={<NavWrap><BookingDetailView /></NavWrap>} />
          <Route path="/users" element={<NavWrap><UsersView /></NavWrap>} />
          <Route path="/users/:userId" element={<NavWrap><UserDetailView /></NavWrap>} />
          <Route path="/locations" element={<NavWrap><LocationsView /></NavWrap>} />
        </Routes>
      </main>
    </div>
    </I18nProvider>
  )
}

function NavWrap({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const params = useParams()
  return (
    <NavigationProvider value={{ navigate, params: params as Record<string, string> }}>
      {children}
    </NavigationProvider>
  )
}
