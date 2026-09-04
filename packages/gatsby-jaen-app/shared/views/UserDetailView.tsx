import { useState, useCallback } from 'react'
import { useAppNavigate, useAppParams } from '../navigation'
import { useUser, setDriverColorMutation } from '../hooks'
import { useI18nCode } from '../i18n'
import { getI18nUsers } from '../locales/i18nUsers'
import { getI18nCommon } from '../locales/i18nCommon'
import {
  cx,
  IconArrowLeft,
  LoadingOverlay, ErrorBanner,
} from '../components/ui'

function getContrastColor(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substr(0, 2), 16)
  const g = parseInt(h.substr(2, 2), 16)
  const b = parseInt(h.substr(4, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000' : '#fff'
}

export function UserDetailView() {
  const { userId } = useAppParams() as { userId: string }
  const navigate = useAppNavigate()
  const { user, isLoading, error } = useUser(userId!)
  const i18nCode = useI18nCode()
  const { strings: ut } = getI18nUsers(i18nCode)
  const { strings: tc } = getI18nCommon(i18nCode)

  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [colorValue, setColorValue] = useState('#000000')
  const [savingColor, setSavingColor] = useState(false)
  const [colorMsg, setColorMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const openColorPicker = useCallback(() => {
    setColorValue(user?.driverColor || '#3b82f6')
    setColorPickerOpen(true)
    setColorMsg(null)
  }, [user?.driverColor])

  const saveColor = useCallback(async () => {
    setSavingColor(true)
    setColorMsg(null)
    try {
      await setDriverColorMutation(userId, colorValue)
      setColorMsg({ type: 'success', text: ut.DriverColorSaved })
      setColorPickerOpen(false)
      window.location.reload()
    } catch (err) {
      setColorMsg({ type: 'error', text: err instanceof Error ? err.message : ut.DriverColorFailed })
    } finally {
      setSavingColor(false)
    }
  }, [userId, colorValue, ut])

  if (isLoading) return <div className="p-6 relative min-h-[200px]"><LoadingOverlay /></div>
  if (error) return <div className="p-6"><ErrorBanner message={error} /></div>
  if (!user) {
    return (
      <div className="p-6">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4" onClick={() => navigate('/users')}>
          <IconArrowLeft className="h-4 w-4" /> {ut.DetailBackLink}
        </button>
        <ErrorBanner message={ut.DetailNotFound} />
      </div>
    )
  }

  const fullName = [user.details?.firstName, user.details?.lastName].filter(Boolean).join(' ') || user.username

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate('/users')}>
        <IconArrowLeft className="h-4 w-4" /> {ut.DetailBackLink}
      </button>

      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
          style={user.driverColor
            ? { backgroundColor: user.driverColor, color: getContrastColor(user.driverColor) }
            : undefined
          }
        >
          {(user.details?.firstName?.[0] || user.username?.[0] || '?').toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{fullName}</h1>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
          <div className={cx(
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold mt-1',
            user.isActive ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'
          )}>
            {user.isActive ? ut.StatusActive : ut.StatusInactive}
          </div>
        </div>
      </div>

      {/* Driver Color */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider">{ut.SectionDriverColor}</h3>
        <div className="flex items-center gap-4">
          <div
            className="h-10 w-10 rounded-lg border-2 border-border flex-shrink-0"
            style={{ backgroundColor: user.driverColor || '#C0C0C0' }}
          />
          <div className="flex-1">
            <div className="text-sm font-medium">{user.driverColor || ut.DriverColorNotSet}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{ut.DriverColorHint}</div>
          </div>
          <button
            className="inline-flex items-center gap-2 border border-input rounded-md px-3 h-9 text-sm hover:bg-muted transition-colors"
            onClick={openColorPicker}
          >
            {ut.DriverColorChange}
          </button>
        </div>

        {colorPickerOpen && (
          <div className="mt-4 p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={colorValue}
                onChange={e => setColorValue(e.target.value)}
                className="h-10 w-14 rounded cursor-pointer border border-input"
              />
              <span className="text-sm font-mono">{colorValue}</span>
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: colorValue, color: getContrastColor(colorValue) }}
              >
                {(user.details?.firstName?.[0] || user.username?.[0] || '?').toUpperCase()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 h-9 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                onClick={saveColor}
                disabled={savingColor}
              >
                {savingColor ? tc.Loading : tc.Save}
              </button>
              <button
                className="inline-flex items-center rounded-md border border-input px-4 h-9 text-sm hover:bg-muted transition-colors"
                onClick={() => setColorPickerOpen(false)}
              >
                {tc.Cancel}
              </button>
            </div>
            {colorMsg && (
              <div className={cx('text-sm', colorMsg.type === 'success' ? 'text-success' : 'text-destructive')}>
                {colorMsg.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Grid */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider">{ut.SectionAccountDetails}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow label={ut.LabelEmail} value={user.primaryEmailAddress} />
          <InfoRow label={ut.LabelUsername} value={user.username} />
          <InfoRow label={ut.LabelUserId} value={user.id} />
          <InfoRow label={ut.LabelCreated} value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'} />
        </div>
      </div>

      {/* Financial Stats */}
      {(user.revenue != null || user.transferCount != null) && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider">{ut.SectionStatistics}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatItem label={ut.StatTotalRevenue} value={`\u20AC ${(user.revenue ?? 0).toFixed(2)}`} />
            <StatItem label={ut.StatTotalTransfers} value={String(user.transferCount ?? 0)} />
            <StatItem label={ut.StatMonthlyRevenue} value={`\u20AC ${(user.monthlyRevenue ?? 0).toFixed(2)}`} />
            <StatItem label={ut.StatMonthlyTransfers} value={String(user.monthlyCount ?? 0)} />
          </div>
        </div>
      )}

      {/* Roles */}
      {user.roles.length > 0 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider">{ut.SectionRoles}</h3>
          <div className="flex flex-wrap gap-2">
            {user.roles.map(role => (
              <div key={role.id} className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-primary/10 text-primary border-primary/20">
                {role.description}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 break-all">{value || '-'}</div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  )
}
