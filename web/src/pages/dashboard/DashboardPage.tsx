import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../lib/api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Select } from '../../components/ui/Field'
import type { ReportSummary } from '../../types'

type Period = 'today' | 'week' | 'month'

function money(amount: number) {
  return new Intl.NumberFormat('fr-HT', { style: 'currency', currency: 'HTG', maximumFractionDigits: 0 }).format(amount)
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex-1">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </Card>
  )
}

export function DashboardPage() {
  const [period, setPeriod] = useState<Period>('month')

  const { data: report, isLoading } = useQuery({
    queryKey: ['reports-certificates', period],
    queryFn: async () => {
      const { data } = await api.get<ReportSummary>('/reports/certificates', { params: { period } })
      return data
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-40">
          <option value="today">Aujourd'hui</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
        </Select>
      </div>

      {isLoading || !report ? (
        <p className="text-neutral-500">Chargement...</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4">
            <StatCard label="Certificats émis" value={String(report.volume.total)} />
            <StatCard label="Revenu encaissé" value={money(report.revenue.total_paid)} />
            <StatCard label="En attente de paiement" value={String(report.revenue.unpaid_count)} />
            <StatCard
              label="Délai moyen"
              value={report.turnaround.avg_hours !== null ? `${report.turnaround.avg_hours} h` : '—'}
            />
          </div>

          <Card>
            <CardHeader title="Volume par jour" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.volume.by_day}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                  <XAxis dataKey="day" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Par médecin" />
              <ul className="space-y-2 text-sm">
                {report.volume.by_doctor.map((row) => (
                  <li key={row.doctor_name} className="flex justify-between">
                    <span>{row.doctor_name}</span>
                    <span className="font-medium">{row.count}</span>
                  </li>
                ))}
                {report.volume.by_doctor.length === 0 && <li className="text-neutral-500">Aucune donnée.</li>}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Répartition clinique" />
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span>Sain</span>
                  <span className="font-medium">{report.clinical.sain_count}</span>
                </li>
                <li className="flex justify-between">
                  <span>Présente des signes</span>
                  <span className="font-medium">{report.clinical.presente_signes_count}</span>
                </li>
                {Object.entries(report.clinical.by_sign).map(([sign, count]) => (
                  <li key={sign} className="flex justify-between pl-4 text-neutral-500">
                    <span>{sign}</span>
                    <span>{count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
