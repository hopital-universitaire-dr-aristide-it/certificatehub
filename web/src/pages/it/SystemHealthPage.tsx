import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'

export function SystemHealthPage() {
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const { data } = await api.get<Record<string, 'ok' | 'down'>>('/system/health')
      return data
    },
    refetchInterval: 15_000,
  })

  const { data: logs } = useQuery({
    queryKey: ['system-logs'],
    queryFn: async () => {
      const { data } = await api.get<{ lines: string[] }>('/system/logs')
      return data.lines
    },
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Etat des services" />
        <div className="flex gap-3">
          {health &&
            Object.entries(health).map(([service, status]) => (
              <div key={service} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <span className="text-sm font-medium capitalize">{service}</span>
                <Badge tone={status === 'ok' ? 'green' : 'red'}>{status === 'ok' ? 'OK' : 'Hors service'}</Badge>
              </div>
            ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Journal applicatif" subtitle="200 dernieres lignes" />
        <pre className="max-h-96 overflow-auto rounded-xl bg-neutral-900 p-4 text-xs text-neutral-200">
          {logs && logs.length > 0 ? logs.join('\n') : 'Aucun log.'}
        </pre>
      </Card>
    </div>
  )
}
