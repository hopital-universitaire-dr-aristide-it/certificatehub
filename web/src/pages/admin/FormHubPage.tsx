import { useState } from 'react'
import { Pencil, Power, RotateCcw } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import { Card, CardHeader } from '../../components/ui/Card'
import { IconButton } from '../../components/ui/IconButton'
import { Badge } from '../../components/ui/Badge'
import { Select, Input, Label, FieldError } from '../../components/ui/Field'
import type { FormDefinition, FormField } from '../../types'

export function FormHubPage() {
  const queryClient = useQueryClient()
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: forms } = useQuery({
    queryKey: ['form-definitions'],
    queryFn: async () => {
      const { data } = await api.get<{ data: FormDefinition[] }>('/form-definitions')
      return data.data
    },
  })

  const { data: fields } = useQuery({
    queryKey: ['form-admin-fields', selectedFormId],
    queryFn: async () => {
      const { data } = await api.get<{ data: FormField[] }>(`/form-definitions/${selectedFormId}/admin-fields`)
      return data.data
    },
    enabled: !!selectedFormId,
  })

  function invalidateFields() {
    queryClient.invalidateQueries({ queryKey: ['form-admin-fields', selectedFormId] })
  }

  const renameMutation = useMutation({
    mutationFn: async ({ fieldId, label }: { fieldId: number; label: string }) => {
      await api.patch(`/form-fields/${fieldId}/rename`, { label })
    },
    onSuccess: invalidateFields,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const resetLabelMutation = useMutation({
    mutationFn: async (fieldId: number) => {
      await api.post(`/form-fields/${fieldId}/reset-label`)
    },
    onSuccess: invalidateFields,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ fieldId, isActive }: { fieldId: number; isActive: boolean }) => {
      await api.patch(`/form-fields/${fieldId}/active`, { is_active: isActive })
    },
    onSuccess: invalidateFields,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Hub des formulaires" subtitle="Renommer les libellés, activer/désactiver les champs" />
        <Label htmlFor="form-select">Formulaire</Label>
        <Select
          id="form-select"
          value={selectedFormId ?? ''}
          onChange={(e) => setSelectedFormId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Sélectionner un formulaire...</option>
          {forms?.map((form) => (
            <option key={form.id} value={form.id}>
              {form.label}
            </option>
          ))}
        </Select>
      </Card>

      {selectedFormId && (
        <Card>
          <CardHeader title="Champs" />
          <FieldError message={error ?? undefined} />
          <div className="space-y-2">
            {fields?.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                onRename={(label) => renameMutation.mutate({ fieldId: field.id, label })}
                onResetLabel={() => resetLabelMutation.mutate(field.id)}
                onToggleActive={(isActive) => toggleActiveMutation.mutate({ fieldId: field.id, isActive })}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function FieldRow({
  field,
  onRename,
  onResetLabel,
  onToggleActive,
}: {
  field: FormField
  onRename: (label: string) => void
  onResetLabel: () => void
  onToggleActive: (isActive: boolean) => void
}) {
  const [label, setLabel] = useState(field.label)
  const isDirty = label !== field.label

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <Badge tone={field.is_active ? 'green' : 'neutral'}>{field.field_type}</Badge>
      <Input className="max-w-xs flex-1" value={label} onChange={(e) => setLabel(e.target.value)} />
      <IconButton icon={Pencil} label="Renommer" tone="primary" disabled={!isDirty} onClick={() => onRename(label)} />
      {field.label !== field.default_label && (
        <IconButton icon={RotateCcw} label="Réinitialiser le libellé" onClick={onResetLabel} />
      )}
      <IconButton
        icon={Power}
        label={field.is_active ? 'Désactiver' : 'Activer'}
        tone={field.is_active ? 'danger' : 'primary'}
        onClick={() => onToggleActive(!field.is_active)}
      />
    </div>
  )
}
