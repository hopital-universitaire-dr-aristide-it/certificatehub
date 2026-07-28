import { useState } from 'react'
import { Power, Save } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Badge } from '../../components/ui/Badge'
import { Input, Label, Select, FieldError } from '../../components/ui/Field'
import type { CertificateType, FormDefinition } from '../../types'

export function CertificateTypesPage() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const { data: types } = useQuery({
    queryKey: ['certificate-types-admin'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CertificateType[] }>('/certificate-types')
      return data.data
    },
  })

  const { data: forms } = useQuery({
    queryKey: ['form-definitions'],
    queryFn: async () => {
      const { data } = await api.get<{ data: FormDefinition[] }>('/form-definitions')
      return data.data
    },
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['certificate-types-admin'] })
  }

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<CertificateType> }) => {
      await api.put(`/certificate-types/${id}`, payload)
    },
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const createMutation = useMutation({
    mutationFn: async (payload: { form_definition_id: number; fee_amount: number; numbering_prefix: string; numbering_next_value: number }) => {
      await api.post('/certificate-types', payload)
    },
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Types de certificats" subtitle="Tarifs et numérotation" />
        <FieldError message={error ?? undefined} />
        <div className="space-y-3">
          {types?.map((type) => (
            <CertificateTypeRow
              key={type.id}
              type={type}
              onSave={(payload) => updateMutation.mutate({ id: type.id, payload })}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Nouveau type de certificat" />
        <NewCertificateTypeForm forms={forms ?? []} onSubmit={(payload) => createMutation.mutate(payload)} />
      </Card>
    </div>
  )
}

function CertificateTypeRow({
  type,
  onSave,
}: {
  type: CertificateType
  onSave: (payload: Partial<CertificateType>) => void
}) {
  const [feeAmount, setFeeAmount] = useState(String(type.fee_amount))
  const [numberingPrefix, setNumberingPrefix] = useState(type.numbering_prefix ?? '')
  const [numberingNextValue, setNumberingNextValue] = useState(String(type.numbering_next_value))
  const [isActive, setIsActive] = useState(type.is_active)

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div>
        <p className="text-sm font-medium">{type.form_label}</p>
        <Badge tone={isActive ? 'green' : 'neutral'}>{isActive ? 'Actif' : 'Inactif'}</Badge>
      </div>
      <div>
        <Label htmlFor={`fee-${type.id}`}>Tarif (HTG)</Label>
        <Input id={`fee-${type.id}`} type="number" className="w-28" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`prefix-${type.id}`}>Préfixe</Label>
        <Input id={`prefix-${type.id}`} className="w-24" value={numberingPrefix} onChange={(e) => setNumberingPrefix(e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`next-${type.id}`}>Prochain numéro</Label>
        <Input
          id={`next-${type.id}`}
          type="number"
          className="w-28"
          value={numberingNextValue}
          onChange={(e) => setNumberingNextValue(e.target.value)}
        />
      </div>
      <IconButton
        icon={Save}
        label="Enregistrer"
        tone="primary"
        onClick={() =>
          onSave({
            fee_amount: Number(feeAmount),
            numbering_prefix: numberingPrefix,
            numbering_next_value: Number(numberingNextValue),
          })
        }
      />
      <IconButton
        icon={Power}
        label={isActive ? 'Désactiver' : 'Activer'}
        tone={isActive ? 'danger' : 'primary'}
        onClick={() => {
          setIsActive(!isActive)
          onSave({ is_active: !isActive })
        }}
      />
    </div>
  )
}

function NewCertificateTypeForm({
  forms,
  onSubmit,
}: {
  forms: FormDefinition[]
  onSubmit: (payload: { form_definition_id: number; fee_amount: number; numbering_prefix: string; numbering_next_value: number }) => void
}) {
  const [formDefinitionId, setFormDefinitionId] = useState('')
  const [feeAmount, setFeeAmount] = useState('')
  const [numberingPrefix, setNumberingPrefix] = useState('')
  const [numberingNextValue, setNumberingNextValue] = useState('1')

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="new-form">Formulaire</Label>
        <Select id="new-form" value={formDefinitionId} onChange={(e) => setFormDefinitionId(e.target.value)}>
          <option value="">Sélectionner...</option>
          {forms.map((form) => (
            <option key={form.id} value={form.id}>
              {form.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="new-fee">Tarif (HTG)</Label>
        <Input id="new-fee" type="number" className="w-28" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="new-prefix">Préfixe</Label>
        <Input id="new-prefix" className="w-24" value={numberingPrefix} onChange={(e) => setNumberingPrefix(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="new-next">Prochain numéro</Label>
        <Input
          id="new-next"
          type="number"
          className="w-28"
          value={numberingNextValue}
          onChange={(e) => setNumberingNextValue(e.target.value)}
        />
      </div>
      <Button
        disabled={!formDefinitionId || !feeAmount}
        onClick={() =>
          onSubmit({
            form_definition_id: Number(formDefinitionId),
            fee_amount: Number(feeAmount),
            numbering_prefix: numberingPrefix,
            numbering_next_value: Number(numberingNextValue),
          })
        }
      >
        Créer
      </Button>
    </div>
  )
}
