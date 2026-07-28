import { api } from './api'

/**
 * Recupere un PDF protege par token (impossible d'utiliser un simple lien
 * <a href> puisque l'authentification se fait par Bearer token, pas par
 * cookie de session) et l'ouvre dans un nouvel onglet via une blob: URL.
 */
export async function openPdfInNewTab(path: string): Promise<void> {
  const { data } = await api.get(path, { responseType: 'blob' })
  const blobUrl = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
  window.open(blobUrl, '_blank')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}
