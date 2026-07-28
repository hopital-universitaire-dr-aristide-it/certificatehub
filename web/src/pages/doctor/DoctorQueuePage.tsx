import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import type { Certificate, PaginatedResponse } from '../../types'

export function DoctorQueuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['certificates-queue'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Certificate>>('/certificates/queue')
      return data.data
    },
    refetchInterval: 10_000,
  })

  return (
    <Card>
      <CardHeader title="File d'attente" subtitle="Certificats payés, en attente de prise en charge" />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
              <th className="py-2 pr-4">Patient</th>
              <th className="py-2 pr-4">Enregistré le</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((cert) => (
              <tr key={cert.id} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="py-2 pr-4">{cert.patient_name}</td>
                <td className="py-2 pr-4">{new Date(cert.created_at).toLocaleString('fr-FR')}</td>
                <td className="py-2 pr-4 text-right">
                  <Link to={`/doctor/certificates/${cert.id}`}>
                    <Button>Prendre en charge</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-neutral-500">
                  Aucun certificat en attente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
