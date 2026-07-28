import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Printer } from 'lucide-react'
import { Button } from './Button'
import { Card, CardHeader } from './Card'
import { Input, Label, Select, Textarea, FieldError } from './Field'
import { Badge } from './Badge'
import { Spinner, FullPageSpinner } from './Spinner'
import { IconButton } from './IconButton'

describe('UI primitives', () => {
  it('Button renders children and handles clicks', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Enregistrer</Button>)
    await userEvent.click(screen.getByText('Enregistrer'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('Button applies the requested variant and disabled state', () => {
    render(
      <Button variant="danger" disabled>
        Supprimer
      </Button>,
    )
    const button = screen.getByText('Supprimer')
    expect(button).toBeDisabled()
  })

  it('Card and CardHeader render title, subtitle and action', () => {
    render(
      <Card>
        <CardHeader title="Titre" subtitle="Sous-titre" action={<span>Action</span>} />
      </Card>,
    )
    expect(screen.getByText('Titre')).toBeInTheDocument()
    expect(screen.getByText('Sous-titre')).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
  })

  it('Field components render and accept input', async () => {
    render(
      <div>
        <Label htmlFor="name">Nom</Label>
        <Input id="name" />
        <Textarea aria-label="notes" />
        <Select aria-label="choix">
          <option value="a">A</option>
        </Select>
        <FieldError message="Erreur" />
      </div>,
    )
    await userEvent.type(screen.getByLabelText('Nom'), 'Jean')
    expect(screen.getByLabelText('Nom')).toHaveValue('Jean')
    expect(screen.getByText('Erreur')).toBeInTheDocument()
  })

  it('FieldError renders nothing without a message', () => {
    const { container } = render(<FieldError />)
    expect(container).toBeEmptyDOMElement()
  })

  it('Badge renders with the requested tone', () => {
    render(<Badge tone="green">Payé</Badge>)
    expect(screen.getByText('Payé')).toBeInTheDocument()
  })

  it('IconButton exposes its label as an accessible name and handles clicks', async () => {
    const onClick = vi.fn()
    render(<IconButton icon={Printer} label="Imprimer" onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Imprimer' })
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('IconButton respects the disabled prop', () => {
    render(<IconButton icon={Printer} label="Imprimer" disabled />)
    expect(screen.getByRole('button', { name: 'Imprimer' })).toBeDisabled()
  })

  it('Spinner and FullPageSpinner render', () => {
    render(
      <div>
        <Spinner />
        <FullPageSpinner />
      </div>,
    )
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })
})
