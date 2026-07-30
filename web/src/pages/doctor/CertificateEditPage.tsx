import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { usePdfPreview } from '../../lib/usePdfPreview'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { FieldError } from '../../components/ui/Field'
import { PdfModal } from '../../components/ui/PdfModal'
import { DynamicForm, type FormValues } from '../../components/forms/DynamicForm'
import type { Certificate, CertificateType, FormField, Patient } from '../../types'

export function CertificateEditPage() {
  const { id } = useParams<{ id: string }>()
  const certificateId = Number(id)
  const queryClient = useQueryClient()
  const [values, setValues] = useState<FormValues>({})
  const [isDirty, setIsDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const pdfPreview = usePdfPreview()

  const {
    data: certificate,
    isLoading: isLoadingCertificate,
    isError: isCertificateError,
    error: certificateError,
  } = useQuery({
    queryKey: ['certificate', certificateId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Certificate }>(`/certificates/${certificateId}`)
      return data.data
    },
  })

  const { data: certificateTypes, isError: isCertificateTypesError, error: certificateTypesError } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CertificateType[] }>('/certificate-types')
      return data.data
    },
  })

  const certificateType = certificateTypes?.find((t) => t.id === certificate?.certificate_type_id)
  const isFinalized = certificate?.status === 'finalized'

  const { data: patient, isError: isPatientError, error: patientError } = useQuery({
    queryKey: ['patient', certificate?.patient_id],
    queryFn: async () => {
      const { data } = await api.get<{ data: Patient }>(`/patients/${certificate!.patient_id}`)
      return data.data
    },
    enabled: !!certificate?.patient_id,
  })

  const { data: fields, isError: isFieldsError, error: fieldsError } = useQuery({
    queryKey: ['form-fields', certificateType?.form_definition_id],
    queryFn: async () => {
      const { data } = await api.get<{ data: FormField[] }>(
        `/form-definitions/${certificateType!.form_definition_id}/fields`,
      )
      return data.data
    },
    enabled: !!certificateType,
  })

  useEffect(() => {
    if (certificate?.form_data) {
      setValues(certificate.form_data)
      setIsDirty(false)
    }
  }, [certificate?.form_data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.put<{ data: Certificate }>(`/certificates/${certificateId}`, { data: values })
      return data.data
    },
    onSuccess: () => {
      setIsDirty(false)
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['certificate', certificateId] })
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  // Sauvegarde automatique : plus besoin pour le medecin de penser a cliquer
  // "Enregistrer" — on persiste la saisie peu apres la derniere frappe. Ne
  // se declenche jamais sur l'hydratation initiale (isDirty ne passe a true
  // que via handleFieldChange, une action de l'utilisateur).
  const debouncedValues = useDebouncedValue(values, 1000)
  useEffect(() => {
    if (!isDirty || isFinalized) return
    saveMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValues, isFinalized])

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      // Flush d'une saisie encore en attente de debounce, pour ne jamais
      // finaliser sur des donnees plus anciennes que ce que le medecin vient
      // de taper.
      if (isDirty) {
        await saveMutation.mutateAsync()
      }
      const { data } = await api.post<{ data: Certificate }>(`/certificates/${certificateId}/finalize`)
      return data.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certificate', certificateId] }),
    onError: (err) => setError(apiErrorMessage(err)),
  })

  function handleFieldChange(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }

  async function handlePreview() {
    setError(null)
    setIsBusy(true)
    try {
      if (isDirty) {
        await saveMutation.mutateAsync()
      }
      await pdfPreview.open(`/certificates/${certificateId}/preview`)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsBusy(false)
    }
  }

  const loadError = [certificateError, certificateTypesError, patientError, fieldsError]
    .filter(Boolean)
    .map((err) => apiErrorMessage(err))
    .at(0)

  if (isLoadingCertificate) {
    return <Card>Chargement...</Card>
  }

  if (isCertificateError || !certificate) {
    return <Card>{loadError ?? 'Impossible de charger ce certificat.'}</Card>
  }

  // Base locale (pas certificate.form_data) : l'apercu flush une saisie en
  // attente avant de s'ouvrir, donc pas besoin d'attendre un aller-retour de
  // sauvegarde pour le debloquer — seulement qu'il y ait quelque chose a
  // montrer.
  const hasFormData = Object.keys(values).length > 0
  const canPreview = hasFormData && !isBusy

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={certificate.patient_name ?? 'Patient'}
          subtitle={certificateType?.form_label ?? undefined}
          action={
            <Badge tone={isFinalized ? 'blue' : 'neutral'}>{isFinalized ? 'Finalisé' : 'Brouillon'}</Badge>
          }
        />
        {isPatientError && <FieldError message="Impossible de charger les informations du patient." />}
        {patient && (
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-neutral-500">Âge</dt>
              <dd>{patient.age ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Sexe</dt>
              <dd>{patient.sex ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Résidence</dt>
              <dd>{patient.residence ?? '—'}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Formulaire"
          action={
            !isFinalized ? (
              saveMutation.isPending ? (
                <Badge tone="neutral">Enregistrement...</Badge>
              ) : hasFormData && !isDirty ? (
                <Badge tone="green">Enregistré</Badge>
              ) : undefined
            ) : undefined
          }
        />
        {isCertificateTypesError && <FieldError message="Impossible de charger les types de certificats." />}
        {isFieldsError && <FieldError message="Impossible de charger le formulaire." />}
        {fields ? (
          <DynamicForm fields={fields} values={values} onChange={handleFieldChange} disabled={isFinalized} />
        ) : (
          !isCertificateTypesError && !isFieldsError && <p className="text-sm text-neutral-500">Chargement du formulaire...</p>
        )}

        <FieldError message={error ?? undefined} />

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={handlePreview} disabled={!canPreview} title={!hasFormData ? "Remplissez d'abord le formulaire" : undefined}>
            Aperçu
          </Button>
          {!isFinalized && (
            <Button onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending}>
              {finalizeMutation.isPending ? 'Finalisation...' : 'Finaliser'}
            </Button>
          )}
          {!isFinalized && !hasFormData && (
            <span className="text-sm text-neutral-500">Aperçu non disponible avant de remplir le formulaire.</span>
          )}
        </div>
        {isFinalized && (
          <p className="mt-3 text-sm text-neutral-500">
            Certificat finalisé — prêt à être imprimé à l'accueil.
          </p>
        )}
      </Card>
      {pdfPreview.url && <PdfModal url={pdfPreview.url} onClose={pdfPreview.close} />}
    </div>
  )
}
