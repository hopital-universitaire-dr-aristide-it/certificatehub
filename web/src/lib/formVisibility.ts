import type { FormField } from '../types'

/**
 * Evalue la clause "visible_when" d'un champ (ex: { outcome: 'presente_signes' }).
 * Toutes les conditions doivent correspondre (AND) pour que le champ soit visible.
 * Un champ sans "visible_when" est toujours visible.
 */
export function isFieldVisible(field: FormField, values: Record<string, unknown>): boolean {
  const condition = field.config?.visible_when
  if (!condition) return true

  return Object.entries(condition).every(([key, expected]) => values[key] === expected)
}

/** Filtre recursivement l'arbre de champs actifs pour ne garder que ceux visibles selon les valeurs courantes. */
export function visibleFields(fields: FormField[], values: Record<string, unknown>): FormField[] {
  return fields.filter((field) => isFieldVisible(field, values))
}
