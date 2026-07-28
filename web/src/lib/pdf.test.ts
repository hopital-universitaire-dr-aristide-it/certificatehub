import { describe, expect, it, vi, beforeEach } from 'vitest'
import { openPdfInNewTab } from './pdf'
import { api } from './api'

vi.mock('./api', () => ({
  api: { get: vi.fn() },
}))

describe('openPdfInNewTab', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    window.open = vi.fn()
  })

  it('fetches the PDF as a blob and opens it in a new tab', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: new Blob(['%PDF-1.4']) })

    await openPdfInNewTab('/certificates/1/preview')

    expect(api.get).toHaveBeenCalledWith('/certificates/1/preview', { responseType: 'blob' })
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(window.open).toHaveBeenCalledWith('blob:mock-url', '_blank')
  })
})
