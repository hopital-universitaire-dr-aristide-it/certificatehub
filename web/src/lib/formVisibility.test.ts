import { describe, expect, it } from 'vitest'
import { isFieldVisible, visibleFields } from './formVisibility'
import type { FormField } from '../types'

function field(overrides: Partial<FormField>): FormField {
  return {
    id: 1,
    field_key: 'outcome',
    label: 'Label',
    default_label: 'Label',
    field_type: 'text',
    is_required: false,
    is_active: true,
    sort_order: 0,
    config: null,
    children: [],
    ...overrides,
  }
}

describe('isFieldVisible', () => {
  it('is visible when there is no visible_when condition', () => {
    expect(isFieldVisible(field({}), {})).toBe(true)
  })

  it('is visible when the condition matches the current values', () => {
    const f = field({ config: { visible_when: { outcome: 'presente_signes' } } })
    expect(isFieldVisible(f, { outcome: 'presente_signes' })).toBe(true)
  })

  it('is hidden when the condition does not match', () => {
    const f = field({ config: { visible_when: { outcome: 'presente_signes' } } })
    expect(isFieldVisible(f, { outcome: 'sain' })).toBe(false)
    expect(isFieldVisible(f, {})).toBe(false)
  })

  it('requires all conditions to match (AND)', () => {
    const f = field({ config: { visible_when: { outcome: 'presente_signes', other: 'x' } } })
    expect(isFieldVisible(f, { outcome: 'presente_signes' })).toBe(false)
    expect(isFieldVisible(f, { outcome: 'presente_signes', other: 'x' })).toBe(true)
  })
})

describe('visibleFields', () => {
  it('filters out fields whose condition does not match', () => {
    const fields = [
      field({ id: 1, field_key: 'outcome' }),
      field({ id: 2, field_key: 'sign_contagieux', config: { visible_when: { outcome: 'presente_signes' } } }),
    ]

    expect(visibleFields(fields, {}).map((f) => f.id)).toEqual([1])
    expect(visibleFields(fields, { outcome: 'presente_signes' }).map((f) => f.id)).toEqual([1, 2])
  })
})
