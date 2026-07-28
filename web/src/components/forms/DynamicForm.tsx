import { Fragment } from 'react'
import type { FormField } from '../../types'
import { visibleFields } from '../../lib/formVisibility'
import { Input, Textarea, Select, Label } from '../ui/Field'

export type FormValues = Record<string, unknown>

interface FieldChangeProps {
  values: FormValues
  onChange: (fieldKey: string, value: unknown) => void
  disabled?: boolean
}

interface DynamicFormProps extends FieldChangeProps {
  fields: FormField[]
}

export function DynamicForm({ fields, values, onChange, disabled }: DynamicFormProps) {
  const visible = visibleFields(fields, values)

  return (
    <div className="space-y-4">
      {visible.map((field) => (
        <Fragment key={field.id}>
          <DynamicFormField field={field} values={values} onChange={onChange} disabled={disabled} />
        </Fragment>
      ))}
    </div>
  )
}

function DynamicFormField({ field, values, onChange, disabled }: FieldChangeProps & { field: FormField }) {
  const value = values[field.field_key]

  if (field.field_type === 'group' || field.field_type === 'paired_lr') {
    return (
      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="mb-3 text-sm font-medium">{field.label}</p>
        <div className={field.field_type === 'paired_lr' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
          <DynamicForm fields={field.children} values={values} onChange={onChange} disabled={disabled} />
        </div>
      </div>
    )
  }

  if (field.field_type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(e) => onChange(field.field_key, e.target.checked)}
        />
        {field.label}
        {field.is_required && <span className="text-red-500">*</span>}
      </label>
    )
  }

  return (
    <div>
      <Label htmlFor={field.field_key}>
        {field.label}
        {field.is_required && <span className="text-red-500"> *</span>}
      </Label>
      <DynamicFieldControl field={field} value={value} onChange={onChange} disabled={disabled} />
    </div>
  )
}

function DynamicFieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField
  value: unknown
  onChange: (fieldKey: string, value: unknown) => void
  disabled?: boolean
}) {
  const id = field.field_key
  const stringValue = typeof value === 'string' || typeof value === 'number' ? String(value) : ''

  switch (field.field_type) {
    case 'textarea':
      return (
        <Textarea
          id={id}
          rows={3}
          placeholder={field.config?.placeholder}
          value={stringValue}
          disabled={disabled}
          onChange={(e) => onChange(field.field_key, e.target.value)}
        />
      )
    case 'number':
      return (
        <Input
          id={id}
          type="number"
          value={stringValue}
          disabled={disabled}
          onChange={(e) => onChange(field.field_key, e.target.valueAsNumber)}
        />
      )
    case 'date':
      return (
        <Input
          id={id}
          type="date"
          value={stringValue}
          disabled={disabled}
          onChange={(e) => onChange(field.field_key, e.target.value)}
        />
      )
    case 'select':
      return (
        <Select id={id} value={stringValue} disabled={disabled} onChange={(e) => onChange(field.field_key, e.target.value)}>
          <option value="">Sélectionner...</option>
          {field.config?.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )
    case 'multiselect': {
      const selected = Array.isArray(value) ? (value as string[]) : []
      return (
        <div className="space-y-1">
          {field.config?.options?.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                checked={selected.includes(option.value)}
                disabled={disabled}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selected, option.value]
                    : selected.filter((v) => v !== option.value)
                  onChange(field.field_key, next)
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
      )
    }
    default:
      return (
        <Input
          id={id}
          placeholder={field.config?.placeholder}
          value={stringValue}
          disabled={disabled}
          onChange={(e) => onChange(field.field_key, e.target.value)}
        />
      )
  }
}
