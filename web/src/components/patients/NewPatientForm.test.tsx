import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewPatientForm, emptyNewPatientValues } from './NewPatientForm'

describe('NewPatientForm', () => {
  it('reports field changes to the parent via onChange', async () => {
    const onChange = vi.fn()
    render(<NewPatientForm values={emptyNewPatientValues} onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('Prénom'), 'J')

    expect(onChange).toHaveBeenCalledWith({ ...emptyNewPatientValues, firstName: 'J' })
  })

  it('displays potential duplicates passed by the parent', () => {
    render(
      <NewPatientForm
        values={emptyNewPatientValues}
        onChange={vi.fn()}
        duplicates={[{ id: 6, full_name: 'Jean Baptist', date_of_birth: '1990-01-01', residence: null }]}
      />,
    )

    expect(screen.getByText('Jean Baptist')).toBeInTheDocument()
  })
})
