import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import type { Certificate, PaginatedResponse } from '../../types'

export function MyCertificatesPage() {
  const [page, setPage] = useState(1)

  const { data: response, isLoading } = useQuery({
    queryKey: ['certificates-mine', page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Certificate>>('/certificates/mine', { params: { page } })
      return data
    },
  })
  const data = response?.data
  const meta = response?.meta

  return (
    <Card>
      <CardHeader title="Mes certificats" subtitle="Certificats que vous avez réalisés" />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
              <th className="py-2 pr-4">Patient</th>
              <th className="py-2 pr-4">Âge</th>
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
                <td className="py-2 pr-4">{cert.patient_age ?? '—'}</td>
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
                <td colSpan={6} className="py-4 text-center text-neutral-500">
                  Aucun certificat réalisé pour l'instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {meta && meta.last_page > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-neutral-500">
            Page {meta.current_page} sur {meta.last_page} ({meta.total} au total)
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={meta.current_page <= 1}>
              Précédent
            </Button>
            <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={meta.current_page >= meta.last_page}>
              Suivant
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
