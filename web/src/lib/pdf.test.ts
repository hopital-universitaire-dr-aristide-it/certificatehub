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
  })

  it('fetches the PDF as a blob and clicks a synthetic blank-target link to it', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: new Blob(['%PDF-1.4']) })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await openPdfInNewTab('/certificates/1/preview')

    expect(api.get).toHaveBeenCalledWith('/certificates/1/preview', { responseType: 'blob' })
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalledOnce()

    const link = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement
    expect(link.href).toBe('blob:mock-url')
    expect(link.target).toBe('_blank')
    expect(link.rel).toBe('noopener')
    expect(document.body.contains(link)).toBe(false)

    clickSpy.mockRestore()
  })

  it('propagates fetch errors', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network error'))

    await expect(openPdfInNewTab('/certificates/1/preview')).rejects.toThrow('network error')
  })
})
