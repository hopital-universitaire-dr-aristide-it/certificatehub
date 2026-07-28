import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Logo } from './Logo'

describe('Logo', () => {
  it('renders an img pointing at /logo.png', () => {
    render(<Logo />)
    const img = screen.getByAltText('Hopital Universitaire Dr. Aristide')
    expect(img).toHaveAttribute('src', '/logo.png')
  })

  it('disappears silently if the logo file is missing', () => {
    render(<Logo />)
    const img = screen.getByAltText('Hopital Universitaire Dr. Aristide')
    fireEvent.error(img)
    expect(screen.queryByAltText('Hopital Universitaire Dr. Aristide')).not.toBeInTheDocument()
  })
})
