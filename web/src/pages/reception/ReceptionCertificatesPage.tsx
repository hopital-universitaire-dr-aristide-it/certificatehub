import { useState } from 'react'
import { Printer, Receipt } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { usePdfPreview } from '../../lib/usePdfPreview'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { useAuth } from '../../lib/auth'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Badge } from '../../components/ui/Badge'
import { Input, Label, FieldError } from '../../components/ui/Field'
import { PdfModal } from '../../components/ui/PdfModal'
import type { Certificate, PaginatedResponse } from '../../types'

function money(amount: number) {
  return new Intl.NumberFormat('fr-HT', { style: 'currency', currency: 'HTG', maximumFractionDigits: 0 }).format(amount)
}

export function ReceptionCertificatesPage() {
  const { hasPermission } = useAuth()
  const canPrint = hasPermission('certificate.print')

  const [patientName, setPatientName] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const pdfPreview = usePdfPreview()

  const debouncedPatientName = useDebouncedValue(patientName, 300)
  const debouncedDoctorName = useDebouncedValue(doctorName, 300)

  const { data: response, isError } = useQuery({
    queryKey: ['reception-certificates', debouncedPatientName, debouncedDoctorName, dateFrom, dateTo, page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Certificate>>('/visits', {
        params: {
          patient_name: debouncedPatientName || undefined,
          doctor_name: debouncedDoctorName || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          page,
        },
      })
      return data
    },
  })
  const certificates = response?.data
  const meta = response?.meta

  function handleFilterChange<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }
  const handlePatientNameChange = handleFilterChange(setPatientName)
  const handleDoctorNameChange = handleFilterChange(setDoctorName)
  const handleDateFromChange = handleFilterChange(setDateFrom)
  const handleDateToChange = handleFilterChange(setDateTo)

  async function handlePrint(certificateId: number) {
    setError(null)
    try {
      await pdfPreview.open(`/certificates/${certificateId}/print`)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  async function handleInvoice(certificateId: number) {
    setError(null)
    try {
      await pdfPreview.open(`/certificates/${certificateId}/invoice`)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Consulter certificats" subtitle="Rechercher un certificat par patient, médecin ou date" />

        <div className="mb-4 grid grid-cols-4 gap-3">
          <div>
            <Label htmlFor="filter-patient-name">Nom du patient</Label>
            <Input id="filter-patient-name" value={patientName} onChange={(e) => handlePatientNameChange(e.target.value)} placeholder="Rechercher..." />
          </div>
          <div>
            <Label htmlFor="filter-doctor-name">Médecin</Label>
            <Input id="filter-doctor-name" value={doctorName} onChange={(e) => handleDoctorNameChange(e.target.value)} placeholder="Rechercher..." />
          </div>
          <div>
            <Label htmlFor="filter-from">Du</Label>
            <Input id="filter-from" type="date" value={dateFrom} onChange={(e) => handleDateFromChange(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="filter-to">Au</Label>
            <Input id="filter-to" type="date" value={dateTo} onChange={(e) => handleDateToChange(e.target.value)} />
          </div>
        </div>

        <FieldError message={error ?? undefined} />

        <div className="overflow-x-auto">
          {isError && <p className="py-4 text-center text-sm text-red-600">Impossible de charger les certificats.</p>}
          {!isError && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                  <th className="py-2 pr-4">Patient</th>
                  <th className="py-2 pr-4">Médecin</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Montant</th>
                  <th className="py-2 pr-4">Paiement</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {certificates?.map((cert) => {
                  const isFinalized = cert.status === 'finalized'
                  return (
                    <tr key={cert.id} className="border-b border-neutral-100 dark:border-neutral-900">
                      <td className="py-2 pr-4">{cert.patient_name}</td>
                      <td className="py-2 pr-4">{cert.doctor_name ?? '—'}</td>
                      <td className="py-2 pr-4">{new Date(cert.created_at).toLocaleDateString('fr-FR')}</td>
                      <td className="py-2 pr-4">{money(cert.fee_amount)}</td>
                      <td className="py-2 pr-4">
                        <Badge tone={cert.payment_status === 'paid' ? 'green' : 'amber'}>
                          {cert.payment_status === 'paid' ? 'Payé' : 'Non payé'}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge tone={isFinalized ? 'blue' : 'neutral'}>{isFinalized ? 'Finalisé' : 'Brouillon'}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <div className="flex justify-end gap-1">
                          {cert.payment_status === 'paid' && canPrint && (
                            <IconButton icon={Receipt} label="Imprimer la facture" onClick={() => handleInvoice(cert.id)} />
                          )}
                          {isFinalized && canPrint && (
                            <IconButton icon={Printer} label="Imprimer" onClick={() => handlePrint(cert.id)} />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {certificates?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-neutral-500">
                      Aucun certificat trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
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
      {pdfPreview.url && <PdfModal url={pdfPreview.url} onClose={pdfPreview.close} />}
    </div>
  )
}
