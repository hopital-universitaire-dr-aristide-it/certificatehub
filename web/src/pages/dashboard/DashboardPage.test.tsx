import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardPage } from './DashboardPage'
import { api } from '../../lib/api'
import type { ReportSummary } from '../../types'

vi.mock('../../lib/api', () => ({ api: { get: vi.fn() } }))

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
    by_certificate_type: [{ type_label: 'Certificat de sante', count: 12 }],
  },
  turnaround: { avg_hours: 2.5 },
  revenue: { total_paid: 6000, unpaid_count: 1, by_day: [] },
  clinical: { sain_count: 8, presente_signes_count: 4, by_sign: { sign_contagieux: 2 } },
  cached_at: new Date().toISOString(),
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
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
})
