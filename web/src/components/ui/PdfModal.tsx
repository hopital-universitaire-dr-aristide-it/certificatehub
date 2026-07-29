import { X } from 'lucide-react'

/**
 * Affiche un PDF dans un panneau superpose PLUTOT que dans un nouvel onglet —
 * ouvrir un nouvel onglet/fenetre (window.open, ou meme un clic synthetique
 * sur <a target="_blank">) reste bloque de maniere inconsistante selon le
 * navigateur/les extensions installees une fois l'appel survenu apres un
 * await. Un <iframe> dans la page elle-meme ne declenche jamais aucun
 * bloqueur de popup, car aucune nouvelle fenetre n'est demandee.
 */
export function PdfModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
          <p className="text-sm font-medium">Document</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <iframe src={url} title="Document PDF" className="flex-1 border-0" />
      </div>
    </div>
  )
}
