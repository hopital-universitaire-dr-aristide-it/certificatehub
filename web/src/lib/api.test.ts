import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { api, apiErrorMessage, registerUnauthorizedHandler, TOKEN_STORAGE_KEY } from './api'

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

// Les intercepteurs axios ne s'executent que sur un vrai aller-retour HTTP —
// inutilisable en test sans mock reseau. On invoque directement les
// callbacks enregistres (axios les expose via interceptors.*.handlers) pour
// couvrir leur logique (attache du token, redirection sur 401) sans monter
// un vrai serveur.
function requestInterceptor(config: { headers: Record<string, string> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (api.interceptors.request as any).handlers[0].fulfilled(config)
}

function responseInterceptors() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (api.interceptors.response as any).handlers[0]
}

describe('api interceptors', () => {
  beforeEach(() => localStorage.clear())

  it('attaches the bearer token from localStorage to outgoing requests', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'abc123')

    const config = requestInterceptor({ headers: {} })

    expect(config.headers.Authorization).toBe('Bearer abc123')
  })

  it('leaves requests untouched when no token is stored', () => {
    const config = requestInterceptor({ headers: {} })

    expect(config.headers.Authorization).toBeUndefined()
  })

  it('passes a successful response through unchanged', () => {
    const response = { data: 'ok' }

    expect(responseInterceptors().fulfilled(response)).toBe(response)
  })

  it('calls the registered unauthorized handler on a 401 and still rejects', async () => {
    const handler = vi.fn()
    registerUnauthorizedHandler(handler)
    const error = { response: { status: 401 } }

    await expect(responseInterceptors().rejected(error)).rejects.toBe(error)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not call the unauthorized handler on other error statuses', async () => {
    const handler = vi.fn()
    registerUnauthorizedHandler(handler)
    const error = { response: { status: 500 } }

    await expect(responseInterceptors().rejected(error)).rejects.toBe(error)
    expect(handler).not.toHaveBeenCalled()
  })
})
