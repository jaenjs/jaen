import { useMemo, useState } from 'react'
import { useAppNavigate } from '../navigation'
import { useUsers } from '../hooks'
import { useI18nCode } from '../i18n'
import { getI18nUsers } from '../locales/i18nUsers'
import { getI18nCommon } from '../locales/i18nCommon'
import {
  cx,
  IconSearch, IconRefresh,
  LoadingOverlay, EmptyState, ErrorBanner, CursorPagination,
} from '../components/ui'

function getContrastColor(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substr(0, 2), 16)
  const g = parseInt(h.substr(2, 2), 16)
  const b = parseInt(h.substr(4, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000' : '#fff'
}

export function UsersView() {
  const { users, isLoading, error, pagination, nextPage, prevPage, refetch } = useUsers()
  const navigate = useAppNavigate()
  const i18nCode = useI18nCode()
  const { strings: t } = getI18nUsers(i18nCode)
  const { strings: tc } = getI18nCommon(i18nCode)
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return users
    const q = searchQuery.toLowerCase()
    return users.filter(u =>
      u.username?.toLowerCase().includes(q) ||
      u.primaryEmailAddress?.toLowerCase().includes(q) ||
      u.details?.firstName?.toLowerCase().includes(q) ||
      u.details?.lastName?.toLowerCase().includes(q)
    )
  }, [users, searchQuery])

  const paginated = filtered

  return (
    <div className="p-4 md:p-6 max-w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t.Heading}</h1>
          <p className="text-muted-foreground mt-1">{t.Subtitle}</p>
        </div>
        <button className="inline-flex items-center gap-2 border border-input rounded-md px-3 h-9 text-sm hover:bg-muted transition-colors" onClick={refetch}>
          <IconRefresh className="h-4 w-4" /> {tc.Refresh}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">{t.StatTotalUsers}</div>
          <div className="text-2xl font-bold mt-1">{pagination.totalCount}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">{t.StatActivePage}</div>
          <div className="text-2xl font-bold mt-1 text-success">{users.filter(u => u.isActive).length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">{t.StatInactivePage}</div>
          <div className="text-2xl font-bold mt-1 text-muted-foreground">{users.filter(u => !u.isActive).length}</div>
        </div>
      </div>

      {/* Search */}
      <div className="w-full md:w-[300px]">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="flex w-full rounded-md border border-input px-3 py-2 text-sm pl-9 h-9 bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={t.SearchPlaceholder}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm relative overflow-visible">
        {isLoading && <LoadingOverlay />}
        {!isLoading && filtered.length === 0 ? (
          <EmptyState message={t.EmptyMessage} />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="h-12 px-4 text-left font-medium text-muted-foreground">{t.ColUser}</th>
                    <th className="h-12 px-4 text-left font-medium text-muted-foreground">{t.ColEmail}</th>
                    <th className="h-12 px-4 text-left font-medium text-muted-foreground">{t.ColStatus}</th>
                    <th className="h-12 px-4 text-left font-medium text-muted-foreground">{t.ColCreated}</th>
                    <th className="h-12 px-4" style={{ width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(u => (
                    <tr key={u.id} className="border-b hover:bg-muted/50 transition-colors" style={{ borderLeft: u.driverColor ? `4px solid ${u.driverColor}` : undefined }}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
                            style={u.driverColor ? { backgroundColor: u.driverColor, color: getContrastColor(u.driverColor) } : undefined}
                          >
                            {(u.details?.firstName?.[0] || u.username?.[0] || '?').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{[u.details?.firstName, u.details?.lastName].filter(Boolean).join(' ') || u.username}</div>
                            <div className="text-xs text-muted-foreground">@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">{u.primaryEmailAddress}</td>
                      <td className="p-4">
                        <div className={cx(
                          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                          u.isActive ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'
                        )}>
                          {u.isActive ? t.StatusActive : t.StatusInactive}
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('de-AT') : '-'}
                      </td>
                      <td className="p-4">
                        <button className="text-sm text-primary hover:underline" onClick={() => navigate(`/users/${u.id}`)}>{tc.Details}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3 p-4">
              {paginated.map(u => (
                <div
                  key={u.id}
                  className="rounded-lg border bg-card p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  style={{ borderLeft: u.driverColor ? `4px solid ${u.driverColor}` : undefined }}
                  onClick={() => navigate(`/users/${u.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
                      style={u.driverColor ? { backgroundColor: u.driverColor, color: getContrastColor(u.driverColor) } : undefined}
                    >
                      {(u.details?.firstName?.[0] || u.username?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{[u.details?.firstName, u.details?.lastName].filter(Boolean).join(' ') || u.username}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.primaryEmailAddress}</div>
                    </div>
                    <div className={cx(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                      u.isActive ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'
                    )}>
                      {u.isActive ? t.StatusActive : t.StatusInactive}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <CursorPagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        hasNextPage={pagination.hasNextPage}
        hasPreviousPage={pagination.hasPreviousPage}
        onNext={nextPage}
        onPrev={prevPage}
      />
    </div>
  )
}
