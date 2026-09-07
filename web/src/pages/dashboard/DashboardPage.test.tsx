import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardPage } from './DashboardPage'
import { renderWithProviders, seedUser, makeUser } from '../../test/renderWithProviders'
import { api } from '../../lib/api'
import type { ReportSummary } from '../../types'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { get: vi.fn() } }
})

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

const report: ReportSummary = {
  period: { from: '2026-07-01', to: '2026-07-31' },
  volume: {
    total: 12,
    by_day: [{ day: '2026-07-01', count: 3 }],
    by_doctor: [{ doctor_name: 'Dr. Test', count: 9 }],
    by_certificate_type: [{ type_label: 'Certificat de santé', count: 12 }],
  },
  turnaround: { avg_hours: 2.5 },
  revenue: { total_paid: 6000, unpaid_count: 1, by_day: [] },
  clinical: { sain_count: 8, presente_signes_count: 4, by_sign: { sign_contagieux: 2 } },
  cached_at: new Date().toISOString(),
}

function renderPage(roles: string[] = ['admin']) {
  seedUser(makeUser({ roles: roles as never, permissions: ['report.view'] }))
  renderWithProviders(<DashboardPage />)
}

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.get).mockReset()
    vi.mocked(api.get).mockResolvedValue({ data: report })
  })

  it('renders KPI stats and breakdowns', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument())
    expect(screen.getByText('Dr. Test')).toBeInTheDocument()
    expect(screen.getByText('2.5 h')).toBeInTheDocument()
  })

  it('refetches when the period changes', async () => {
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/reports/certificates', { params: { period: 'month' } }))

    await userEvent.selectOptions(screen.getByDisplayValue('Ce mois'), 'today')

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/reports/certificates', { params: { period: 'today' } }))
  })

  it('hides the custom period option from a non-superadmin', async () => {
    renderPage(['admin'])
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument())

    expect(screen.queryByText('Période personnalisée')).not.toBeInTheDocument()
  })

  it('lets a superadmin query a custom date range', async () => {
    renderPage(['superadmin'])
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument())

    await userEvent.selectOptions(screen.getByDisplayValue('Ce mois'), 'custom')
    expect(screen.getByText('Choisissez une date de début pour afficher la période personnalisée.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Depuis le'), '2026-01-01')

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/reports/certificates', {
        params: { period: 'custom', date_from: '2026-01-01', date_to: expect.any(String) },
      }),
    )
  })
})
