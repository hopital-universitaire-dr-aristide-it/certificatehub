export function ProgressBar({ label }: { label?: string }) {
  return (
    <div className="mt-3" role="progressbar" aria-label={label ?? 'Enregistrement en cours'}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className="h-full animate-progress-indeterminate rounded-full bg-blue-600" />
      </div>
      {label && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{label}</p>}
    </div>
  )
}
