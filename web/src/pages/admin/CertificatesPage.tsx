import { useState } from 'react'
import { Ban, Printer, Receipt, RotateCcw, Undo2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

type View = 'active' | 'trash'

function money(amount: number) {
  return new Intl.NumberFormat('fr-HT', { style: 'currency', currency: 'HTG', maximumFractionDigits: 0 }).format(amount)
}

export function CertificatesPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canCancelCertificate = hasPermission('certificate.delete')
  const canRestoreCertificate = hasPermission('certificate.restore')
  const canCancelPayment = hasPermission('certificate.cancel_payment')
  const canPrint = hasPermission('certificate.print')

  const [view, setView] = useState<View>('active')
  const [patientName, setPatientName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [isPrintingSelection, setIsPrintingSelection] = useState(false)
  const pdfPreview = usePdfPreview()

  const debouncedName = useDebouncedValue(patientName, 300)

  const { data: certificates, isError } = useQuery({
    queryKey: ['certificates-oversight', debouncedName, dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Certificate>>('/visits', {
        params: {
          patient_name: debouncedName || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      })
      return data.data
    },
    enabled: view === 'active',
  })

  const { data: trashedCertificates, isError: isTrashError } = useQuery({
    queryKey: ['certificates-trashed'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Certificate>>('/certificates/trashed')
      return data.data
    },
    enabled: view === 'trash' && canRestoreCertificate,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['certificates-oversight'] })
    queryClient.invalidateQueries({ queryKey: ['certificates-trashed'] })
  }

  const cancelCertificateMutation = useMutation({
    mutationFn: async (certificateId: number) => {
      await api.delete(`/certificates/${certificateId}`)
    },
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const restoreCertificateMutation = useMutation({
    mutationFn: async (certificateId: number) => {
      await api.post(`/certificates/${certificateId}/restore`)
    },
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const cancelPaymentMutation = useMutation({
    mutationFn: async (certificateId: number) => {
      await api.post(`/visits/${certificateId}/cancel-payment`)
    },
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  function toggleSelected(certificateId: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(certificateId)) {
        next.delete(certificateId)
      } else {
        next.add(certificateId)
      }
      return next
    })
  }

  const [printQueue, setPrintQueue] = useState<number[]>([])

  async function printSelection() {
    setError(null)
    const ids = [...selected]
    if (ids.length === 0) return
    setIsPrintingSelection(true)
    try {
      setPrintQueue(ids.slice(1))
      await pdfPreview.open(`/certificates/${ids[0]}/print`)
      setSelected(new Set())
    } catch (err) {
      setError(apiErrorMessage(err))
      setIsPrintingSelection(false)
    }
  }

  async function handlePreviewClose() {
    if (printQueue.length > 0) {
      const [next, ...rest] = printQueue
      setPrintQueue(rest)
      try {
        await pdfPreview.open(`/certificates/${next}/print`)
      } catch (err) {
        setError(apiErrorMessage(err))
        setIsPrintingSelection(false)
        pdfPreview.close()
      }
      return
    }
    setIsPrintingSelection(false)
    pdfPreview.close()
  }

  const printableSelectedCount = [...selected].length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Certificats"
          subtitle="Rechercher, imprimer en lot, et annuler une action de l'accueil ou du médecin"
          action={
            canRestoreCertificate && (
              <div className="flex gap-2">
                <Button variant={view === 'active' ? 'primary' : 'secondary'} onClick={() => setView('active')}>
                  Actifs
                </Button>
                <Button variant={view === 'trash' ? 'primary' : 'secondary'} onClick={() => setView('trash')}>
                  Corbeille
                </Button>
              </div>
            )
          }
        />

        <FieldError message={error ?? undefined} />

        {view === 'active' && (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="filter-name">Nom du patient</Label>
                <Input id="filter-name" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Rechercher..." />
              </div>
              <div>
                <Label htmlFor="filter-from">Du</Label>
                <Input id="filter-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="filter-to">Au</Label>
                <Input id="filter-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>

            {canPrint && (
              <div className="mb-3">
                <Button variant="secondary" disabled={printableSelectedCount === 0 || isPrintingSelection} onClick={printSelection}>
                  {isPrintingSelection ? 'Impression...' : `Imprimer la sélection (${printableSelectedCount})`}
                </Button>
              </div>
            )}

            <div className="overflow-x-auto">
              {isError && <p className="py-4 text-center text-sm text-red-600">Impossible de charger les certificats.</p>}
              {!isError && (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                      <th className="py-2 pr-4"></th>
                      <th className="py-2 pr-4">Patient</th>
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
                          <td className="py-2 pr-4">
                            {isFinalized && canPrint && (
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                                checked={selected.has(cert.id)}
                                onChange={() => toggleSelected(cert.id)}
                              />
                            )}
                          </td>
                          <td className="py-2 pr-4">{cert.patient_name}</td>
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
                                <IconButton
                                  icon={Receipt}
                                  label="Imprimer la facture"
                                  onClick={() => pdfPreview.open(`/certificates/${cert.id}/invoice`).catch((err) => setError(apiErrorMessage(err)))}
                                />
                              )}
                              {isFinalized && canPrint && (
                                <IconButton
                                  icon={Printer}
                                  label="Imprimer"
                                  onClick={() => pdfPreview.open(`/certificates/${cert.id}/print`).catch((err) => setError(apiErrorMessage(err)))}
                                />
                              )}
                              {cert.payment_status === 'paid' && canCancelPayment && (
                                <IconButton
                                  icon={Undo2}
                                  label="Annuler le paiement"
                                  tone="danger"
                                  onClick={() => {
                                    if (window.confirm('Annuler ce paiement ? Le certificat redeviendra non payé.')) {
                                      cancelPaymentMutation.mutate(cert.id)
                                    }
                                  }}
                                />
                              )}
                              {canCancelCertificate && (
                                <IconButton
                                  icon={Ban}
                                  label="Annuler le certificat"
                                  tone="danger"
                                  onClick={() => {
                                    if (window.confirm('Annuler ce certificat ? Il pourra être rétabli depuis la corbeille.')) {
                                      cancelCertificateMutation.mutate(cert.id)
                                    }
                                  }}
                                />
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
          </>
        )}

        {view === 'trash' && (
          <div className="space-y-2">
            {isTrashError && <p className="py-4 text-center text-sm text-red-600">Impossible de charger la corbeille.</p>}
            {!isTrashError && trashedCertificates?.map((cert) => (
              <div key={cert.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-3 opacity-70 dark:border-neutral-800">
                <div className="min-w-48">
                  <p className="text-sm font-medium">{cert.patient_name}</p>
                  <p className="text-xs text-neutral-500">{new Date(cert.created_at).toLocaleDateString('fr-FR')} — {money(cert.fee_amount)}</p>
                </div>
                <Badge tone="red">Annulé</Badge>
                <IconButton
                  icon={RotateCcw}
                  label="Rétablir le certificat"
                  tone="primary"
                  onClick={() => restoreCertificateMutation.mutate(cert.id)}
                />
              </div>
            ))}
            {!isTrashError && trashedCertificates?.length === 0 && (
              <p className="py-4 text-center text-sm text-neutral-500">Corbeille vide.</p>
            )}
          </div>
        )}
      </Card>
      {pdfPreview.url && <PdfModal url={pdfPreview.url} onClose={handlePreviewClose} />}
    </div>
  )
}
