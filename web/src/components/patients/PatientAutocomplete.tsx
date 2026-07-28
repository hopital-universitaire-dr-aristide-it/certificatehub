import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Input } from '../ui/Field'
import { Spinner } from '../ui/Spinner'
import type { PatientSummary } from '../../types'

interface PatientAutocompleteProps {
  onSelect: (patient: PatientSummary) => void
  placeholder?: string
}

/** Debounce simple : ne relance la recherche qu'apres 300ms d'inactivite de saisie. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

export function PatientAutocomplete({ onSelect, placeholder }: PatientAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const debouncedQuery = useDebouncedValue(query, 300)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['patients-search', debouncedQuery],
    queryFn: async () => {
      const { data } = await api.get<{ data: PatientSummary[] }>('/patients/search', {
        params: { q: debouncedQuery },
      })
      return data.data
    },
    enabled: debouncedQuery.trim().length >= 2,
  })

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const results = data ?? []

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        placeholder={placeholder ?? 'Rechercher un patient (nom, prenom...)'}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && debouncedQuery.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {isFetching && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-500">
              <Spinner className="h-4 w-4" /> Recherche...
            </div>
          )}
          {!isFetching && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-neutral-500">Aucun patient trouve.</p>
          )}
          {results.map((patient) => (
            <button
              key={patient.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => {
                onSelect(patient)
                setQuery(patient.full_name)
                setIsOpen(false)
              }}
            >
              <span className="font-medium">{patient.full_name}</span>
              {patient.date_of_birth && (
                <span className="ml-2 text-neutral-500">{patient.date_of_birth}</span>
              )}
              {patient.residence && <span className="ml-2 text-neutral-400">{patient.residence}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
