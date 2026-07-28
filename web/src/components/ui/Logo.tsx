import { useState } from 'react'

/**
 * Cherche /logo.png (a deposer dans web/public/logo.png, servi tel quel par
 * Vite/nginx). Tant que le fichier n'existe pas, se replie silencieusement
 * sur le texte seul plutot que d'afficher une icone d'image cassee.
 */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) return null

  return (
    <img
      src="/logo.png"
      alt="Hopital Universitaire Dr. Aristide"
      className={`rounded-lg object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  )
}
