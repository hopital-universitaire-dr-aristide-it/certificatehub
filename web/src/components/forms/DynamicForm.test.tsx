import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DynamicForm } from './DynamicForm'
import type { FormField } from '../../types'

function field(overrides: Partial<FormField>): FormField {
  return {
    id: overrides.id ?? Math.random(),
    field_key: 'field',
    label: 'Field',
    default_label: 'Field',
    field_type: 'text',
    is_required: false,
    is_active: true,
    sort_order: 0,
    config: null,
    children: [],
    ...overrides,
  }
}

describe('DynamicForm', () => {
  it('renders a select field and reports changes', async () => {
    const onChange = vi.fn()
    const outcome = field({
      id: 1,
      field_key: 'outcome',
      label: 'Résultat',
      field_type: 'select',
      config: { options: [{ value: 'sain', label: 'Sain' }, { value: 'presente_signes', label: 'Présente des signes' }] },
    })

    render(<DynamicForm fields={[outcome]} values={{}} onChange={onChange} />)

    await userEvent.selectOptions(screen.getByLabelText('Résultat'), 'presente_signes')
    expect(onChange).toHaveBeenCalledWith('outcome', 'presente_signes')
  })

  it('hides conditional fields until visible_when matches', async () => {
    const onChange = vi.fn()
    const fields = [
      field({ id: 1, field_key: 'outcome', label: 'Résultat', field_type: 'select', config: { options: [] } }),
      field({
        id: 2,
        field_key: 'sign_contagieux',
        label: 'Signes contagieux',
        field_type: 'boolean',
        config: { visible_when: { outcome: 'presente_signes' } },
      }),
    ]

    const { rerender } = render(<DynamicForm fields={fields} values={{}} onChange={onChange} />)
    expect(screen.queryByText('Signes contagieux')).not.toBeInTheDocument()

    rerender(<DynamicForm fields={fields} values={{ outcome: 'presente_signes' }} onChange={onChange} />)
    expect(screen.getByText('Signes contagieux')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith('sign_contagieux', true)
  })

  it('renders textarea, number, date and multiselect controls', async () => {
    const onChange = vi.fn()
    const fields = [
      field({ id: 1, field_key: 'notes', label: 'Notes', field_type: 'textarea' }),
      field({ id: 2, field_key: 'age', label: 'Âge', field_type: 'number' }),
      field({ id: 3, field_key: 'date', label: 'Date', field_type: 'date' }),
      field({
        id: 4,
        field_key: 'tags',
        label: 'Tags',
        field_type: 'multiselect',
        config: { options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }] },
      }),
    ]

    render(<DynamicForm fields={fields} values={{ tags: ['x'] }} onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('Notes'), 'a')
    expect(onChange).toHaveBeenCalledWith('notes', expect.any(String))

    await userEvent.type(screen.getByLabelText('Âge'), '3')
    expect(onChange).toHaveBeenCalledWith('age', expect.any(Number))

    const checkboxes = screen.getAllByRole('checkbox')
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true)
    await userEvent.click(checkboxes[1])
    expect(onChange).toHaveBeenCalledWith('tags', ['x', 'y'])
  })

  it('renders group and paired_lr containers with nested children', () => {
    const onChange = vi.fn()
    const group = field({
      id: 1,
      field_key: 'group',
      label: 'Groupe',
      field_type: 'group',
      children: [field({ id: 2, field_key: 'child', label: 'Enfant', field_type: 'text' })],
    })

    render(<DynamicForm fields={[group]} values={{}} onChange={onChange} />)
    expect(screen.getByText('Groupe')).toBeInTheDocument()
    expect(screen.getByLabelText('Enfant')).toBeInTheDocument()
  })

  it('disables controls when disabled is passed', () => {
    const fields = [field({ id: 1, field_key: 'name', label: 'Nom', field_type: 'text' })]
    render(<DynamicForm fields={fields} values={{}} onChange={vi.fn()} disabled />)
    expect(screen.getByLabelText('Nom')).toBeDisabled()
  })
})
