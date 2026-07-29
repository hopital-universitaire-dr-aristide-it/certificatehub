import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import type { Certificate, PaginatedResponse } from '../../types'

export function MyCertificatesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['certificates-mine'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Certificate>>('/certificates/mine')
      return data.data
    },
  })

  return (
    <Card>
      <CardHeader title="Mes certificats" subtitle="Certificats que vous avez réalisés" />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
              <th className="py-2 pr-4">Patient</th>
              <th className="py-2 pr-4">N°</th>
              <th className="py-2 pr-4">Statut</th>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((cert) => (
              <tr key={cert.id} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="py-2 pr-4">{cert.patient_name}</td>
                <td className="py-2 pr-4">{cert.certificate_number ?? '—'}</td>
                <td className="py-2 pr-4">
                  <Badge tone={cert.status === 'finalized' ? 'blue' : 'neutral'}>
                    {cert.status === 'finalized' ? 'Finalisé' : 'Brouillon'}
                  </Badge>
                </td>
                <td className="py-2 pr-4">{new Date(cert.created_at).toLocaleDateString('fr-FR')}</td>
                <td className="py-2 pr-4 text-right">
                  <Link to={`/doctor/certificates/${cert.id}`}>
                    <Button variant="secondary">Voir</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-neutral-500">
                  Aucun certificat réalisé pour l'instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
