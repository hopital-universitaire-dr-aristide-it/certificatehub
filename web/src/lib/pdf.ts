import { api } from './api'

/**
 * Recupere un PDF protege par token (impossible d'utiliser un simple lien
 * <a href> statique puisque l'authentification se fait par Bearer token, pas
 * par cookie de session) et l'ouvre dans un nouvel onglet via une blob: URL.
 *
 * Utilise un clic synthetique sur un <a target="_blank"> plutot que
 * window.open() : window.open() est bloque par la plupart des navigateurs
 * des qu'il survient apres un await (le geste utilisateur d'origine ne
 * "couvre" plus l'appel une fois la reponse HTTP revenue), meme en
 * pre-ouvrant un onglet vide avant l'appel reseau. Une navigation par <a>
 * cliquee est traitee bien plus souplement par les bloqueurs de popup.
 */
export async function openPdfInNewTab(path: string): Promise<void> {
  const { data } = await api.get(path, { responseType: 'blob' })
  const blobUrl = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))

  const link = document.createElement('a')
  link.href = blobUrl
  link.target = '_blank'
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}
