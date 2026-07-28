import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { apiErrorMessage } from './api'

function axiosErrorWithData(data: unknown): AxiosError {
  const error = new AxiosError('Request failed')
  error.response = {
    data,
    status: 422,
    statusText: 'Unprocessable Entity',
    headers: {},
    config: { headers: new AxiosHeaders() },
  }
  return error
}

describe('apiErrorMessage', () => {
  it('joins validation errors when present', () => {
    const error = axiosErrorWithData({ errors: { email: ['Le champ est requis.'], password: ['Trop court.'] } })
    expect(apiErrorMessage(error)).toBe('Le champ est requis. Trop court.')
  })

  it('falls back to the message field', () => {
    const error = axiosErrorWithData({ message: 'Non autorisé.' })
    expect(apiErrorMessage(error)).toBe('Non autorisé.')
  })

  it('returns a generic message for non-axios errors', () => {
    expect(apiErrorMessage(new Error('boom'))).toBe('Une erreur inattendue est survenue.')
  })
})
