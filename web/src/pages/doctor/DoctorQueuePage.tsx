import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Field'
import type { Certificate, PaginatedResponse } from '../../types'

export function DoctorQueuePage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['certificates-queue', debouncedSearch, page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Certificate>>('/certificates/queue', {
        params: { patient_name: debouncedSearch || undefined, page },
      })
      return data
    },
    refetchInterval: 10_000,
  })

  const certificates = data?.data
  const meta = data?.meta

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  return (
    <Card>
      <CardHeader title="File d'attente" subtitle="Certificats payés, en attente de prise en charge" />

      <div className="mb-4">
        <Label htmlFor="queue-search">Rechercher un patient</Label>
        <Input
          id="queue-search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Nom, prénom..."
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
              <th className="py-2 pr-4">Patient</th>
              <th className="py-2 pr-4">Âge</th>
              <th className="py-2 pr-4">Enregistré le</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {certificates?.map((cert) => (
              <tr key={cert.id} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="py-2 pr-4">{cert.patient_name}</td>
                <td className="py-2 pr-4">{cert.patient_age ?? '—'}</td>
                <td className="py-2 pr-4">{new Date(cert.created_at).toLocaleString('fr-FR')}</td>
                <td className="py-2 pr-4 text-right">
                  <Link to={`/doctor/certificates/${cert.id}`}>
                    <Button>Prendre en charge</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {!isLoading && certificates?.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-neutral-500">
                  Aucun certificat en attente.
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
