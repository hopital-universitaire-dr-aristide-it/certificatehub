import { useState } from 'react'
import { Banknote, Printer } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { openPdfInNewTab } from '../../lib/pdf'
import { useAuth } from '../../lib/auth'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Badge } from '../../components/ui/Badge'
import { Select, Label, FieldError } from '../../components/ui/Field'
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
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)
  const canPrint = hasPermission('certificate.print')

  const { data: certificateTypes } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CertificateType[] }>('/certificate-types')
      return data.data.filter((t) => t.is_active)
    },
  })

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
      const { data } = await api.post('/visits', {
        patient_id: selectedPatient!.id,
        certificate_type_id: Number(certificateTypeId),
      })
      return data as Certificate
    },
    onSuccess: () => {
      setSelectedPatient(null)
      setCertificateTypeId('')
      queryClient.invalidateQueries({ queryKey: ['visits'] })
    },
    onError: (err) => setRegisterError(apiErrorMessage(err)),
  })

  const markPaid = useMutation({
    mutationFn: async (certificateId: number) => {
      const { data } = await api.post(`/visits/${certificateId}/mark-paid`)
      return data as Certificate
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
      await openPdfInNewTab(`/certificates/${certificateId}/print`)
    } catch (err) {
      setPrintError(apiErrorMessage(err))
    }
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

        <FieldError message={registerError ?? undefined} />

        <Button className="mt-4" onClick={handleRegister} disabled={registerVisit.isPending}>
          {registerVisit.isPending ? 'Enregistrement...' : 'Enregistrer la visite'}
        </Button>
      </Card>

      <Card>
        <CardHeader title="Visites du jour" subtitle="Marquer le paiement pour libérer l'accès au médecin" />
        <FieldError message={printError ?? undefined} />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
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
                      {visit.status === 'finalized' && canPrint && (
                        <IconButton icon={Printer} label="Imprimer" onClick={() => handlePrint(visit.id)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visits?.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-neutral-500">
                    Aucune visite enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
