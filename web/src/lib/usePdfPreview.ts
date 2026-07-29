import { useCallback, useState } from 'react'
import { api } from './api'

/**
 * Recupere un PDF protege par token et le rend disponible pour affichage
 * dans un <PdfModal> (voir components/ui/PdfModal.tsx) au lieu de tenter de
 * l'ouvrir dans un nouvel onglet — evite completement les blocages de popup
 * inconsistants selon navigateur/extensions.
 */
export function usePdfPreview() {
  const [url, setUrl] = useState<string | null>(null)

  const open = useCallback(async (path: string) => {
    const { data } = await api.get(path, { responseType: 'blob' })
    const blobUrl = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
    setUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return blobUrl
    })
  }, [])

  const close = useCallback(() => {
    setUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return null
    })
  }, [])

  return { url, open, close }
}
