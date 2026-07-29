import { useEffect, useState } from 'react'
import { Banknote, Printer, Receipt } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { usePdfPreview } from '../../lib/usePdfPreview'
import { useAuth } from '../../lib/auth'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Badge } from '../../components/ui/Badge'
import { Select, Label, FieldError } from '../../components/ui/Field'
import { PdfModal } from '../../components/ui/PdfModal'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { PatientAutocomplete } from '../../components/patients/PatientAutocomplete'
import { NewPatientForm } from '../../components/patients/NewPatientForm'
import type { Certificate, CertificateType, Patient, PatientSummary, PaginatedResponse } from '../../types'

function money(amount: number) {
  return new Intl.NumberFormat('fr-HT', { style: 'currency', currency: 'HTG', maximumFractionDigits: 0 }).format(amount)
}

export function ReceptionPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const [mode, setMode] = useState<'search' | 'create'>('search')
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | Patient | null>(null)
  const [certificateTypeId, setCertificateTypeId] = useState<string>('')
  const [markPaidAtRegistration, setMarkPaidAtRegistration] = useState(true)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [printQueue, setPrintQueue] = useState<number[]>([])
  const [isPrintingSelection, setIsPrintingSelection] = useState(false)
  const canPrint = hasPermission('certificate.print')
  const pdfPreview = usePdfPreview()

  const { data: certificateTypes } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CertificateType[] }>('/certificate-types')
      return data.data.filter((t) => t.is_active)
    },
  })

  // Le certificat de sante est le seul type utilise au quotidien — le
  // pre-selectionner evite un clic repetitif a l'accueil a chaque visite.
  useEffect(() => {
    if (certificateTypeId || !certificateTypes?.length) return
    const defaultType = certificateTypes.find((t) => t.form_label === 'Certificat de santé') ?? certificateTypes[0]
    setCertificateTypeId(String(defaultType.id))
  }, [certificateTypes, certificateTypeId])

  const { data: visits } = useQuery({
    queryKey: ['visits'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Certificate>>('/visits')
      return data.data
    },
    refetchInterval: 10_000,
  })

  const registerVisit = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: Certificate }>('/visits', {
        patient_id: selectedPatient!.id,
        certificate_type_id: Number(certificateTypeId),
        mark_paid: markPaidAtRegistration,
      })
      return data.data
    },
    onSuccess: () => {
      setSelectedPatient(null)
      setMarkPaidAtRegistration(true)
      queryClient.invalidateQueries({ queryKey: ['visits'] })
    },
    onError: (err) => setRegisterError(apiErrorMessage(err)),
  })

  const markPaid = useMutation({
    mutationFn: async (certificateId: number) => {
      const { data } = await api.post<{ data: Certificate }>(`/visits/${certificateId}/mark-paid`)
      return data.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits'] }),
  })

  function handleRegister() {
    setRegisterError(null)
    if (!selectedPatient || !certificateTypeId) {
      setRegisterError('Sélectionnez un patient et un type de certificat.')
      return
    }
    registerVisit.mutate()
  }

  async function handlePrint(certificateId: number) {
    setPrintError(null)
    try {
      await pdfPreview.open(`/certificates/${certificateId}/print`)
    } catch (err) {
      setPrintError(apiErrorMessage(err))
    }
  }

  async function handleInvoice(certificateId: number) {
    setPrintError(null)
    try {
      await pdfPreview.open(`/certificates/${certificateId}/invoice`)
    } catch (err) {
      setPrintError(apiErrorMessage(err))
    }
  }

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

  async function printSelection() {
    setPrintError(null)
    const ids = [...selected]
    if (ids.length === 0) return
    setIsPrintingSelection(true)
    try {
      setPrintQueue(ids.slice(1))
      await pdfPreview.open(`/certificates/${ids[0]}/print`)
      setSelected(new Set())
    } catch (err) {
      setPrintError(apiErrorMessage(err))
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
        setPrintError(apiErrorMessage(err))
        setIsPrintingSelection(false)
        pdfPreview.close()
      }
      return
    }
    setIsPrintingSelection(false)
    pdfPreview.close()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Enregistrer une visite" subtitle="Sélectionner un patient existant ou en créer un nouveau" />
        <div className="mb-4 flex gap-2">
          <Button variant={mode === 'search' ? 'primary' : 'secondary'} onClick={() => setMode('search')}>
            Patient existant
          </Button>
          <Button variant={mode === 'create' ? 'primary' : 'secondary'} onClick={() => setMode('create')}>
            Nouveau patient
          </Button>
        </div>

        {mode === 'search' ? (
          <PatientAutocomplete onSelect={setSelectedPatient} />
        ) : (
          <NewPatientForm onCreated={(patient) => { setSelectedPatient(patient); setMode('search') }} />
        )}

        {selectedPatient && (
          <p className="mt-3 text-sm">
            Patient sélectionné : <Badge tone="blue">{selectedPatient.full_name}</Badge>
          </p>
        )}

        <div className="mt-4">
          <Label htmlFor="certificate_type">Type de certificat</Label>
          <Select id="certificate_type" value={certificateTypeId} onChange={(e) => setCertificateTypeId(e.target.value)}>
            <option value="">Sélectionner...</option>
            {certificateTypes?.map((type) => (
              <option key={type.id} value={type.id}>
                {type.form_label} — {money(type.fee_amount)}
              </option>
            ))}
          </Select>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
            checked={markPaidAtRegistration}
            onChange={(e) => setMarkPaidAtRegistration(e.target.checked)}
          />
          Paiement reçu maintenant
        </label>

        <FieldError message={registerError ?? undefined} />

        <Button className="mt-4" onClick={handleRegister} disabled={registerVisit.isPending}>
          {registerVisit.isPending ? 'Enregistrement...' : 'Enregistrer la visite'}
        </Button>
        {registerVisit.isPending && <ProgressBar label="Enregistrement de la visite..." />}
      </Card>

      <Card>
        <CardHeader title="Visites du jour" subtitle="Marquer le paiement pour libérer l'accès au médecin" />
        <FieldError message={printError ?? undefined} />
        {canPrint && (
          <div className="mb-3">
            <Button variant="secondary" disabled={selected.size === 0 || isPrintingSelection} onClick={printSelection}>
              {isPrintingSelection ? 'Impression...' : `Imprimer la sélection (${selected.size})`}
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                <th className="py-2 pr-4"></th>
                <th className="py-2 pr-4">Patient</th>
                <th className="py-2 pr-4">Montant</th>
                <th className="py-2 pr-4">Paiement</th>
                <th className="py-2 pr-4">Statut</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {visits?.map((visit) => (
                <tr key={visit.id} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-2 pr-4">
                    {visit.status === 'finalized' && canPrint && (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                        checked={selected.has(visit.id)}
                        onChange={() => toggleSelected(visit.id)}
                      />
                    )}
                  </td>
                  <td className="py-2 pr-4">{visit.patient_name}</td>
                  <td className="py-2 pr-4">{money(visit.fee_amount)}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={visit.payment_status === 'paid' ? 'green' : 'amber'}>
                      {visit.payment_status === 'paid' ? 'Payé' : 'Non payé'}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge tone={visit.status === 'finalized' ? 'blue' : 'neutral'}>
                      {visit.status === 'finalized' ? 'Prêt à imprimer' : 'Brouillon'}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <div className="flex justify-end gap-1">
                      {visit.payment_status === 'unpaid' && (
                        <IconButton
                          icon={Banknote}
                          label="Marquer payé"
                          tone="primary"
                          onClick={() => markPaid.mutate(visit.id)}
                          disabled={markPaid.isPending}
                        />
                      )}
                      {visit.payment_status === 'paid' && canPrint && (
                        <IconButton icon={Receipt} label="Imprimer la facture" onClick={() => handleInvoice(visit.id)} />
                      )}
                      {visit.status === 'finalized' && canPrint && (
                        <IconButton icon={Printer} label="Imprimer" onClick={() => handlePrint(visit.id)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visits?.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-neutral-500">
                    Aucune visite enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {pdfPreview.url && <PdfModal url={pdfPreview.url} onClose={handlePreviewClose} />}
    </div>
  )
}
