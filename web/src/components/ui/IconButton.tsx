import { type ButtonHTMLAttributes, forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'

type Tone = 'neutral' | 'primary' | 'danger'

const toneClasses: Record<Tone, string> = {
  neutral:
    'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
  primary: 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950',
  danger: 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950',
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  tone?: Tone
}

/** Bouton d'action compact (icone + tooltip natif via `title`) pour les actions repetees en ligne de tableau. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, tone = 'neutral', className = '', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${toneClasses[tone]} ${className}`}
      {...props}
    >
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
    </button>
  )
})
