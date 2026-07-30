<?php

namespace Modules\Patient\Services;

use Illuminate\Support\Collection;
use Modules\Patient\Models\Patient;

class DeduplicationService
{
    private const DEFAULT_THRESHOLD = 0.4;

    /**
     * Correspondance exacte (nom/prenom insensibles aux accents et a la
     * casse, sexe, date de naissance) — utilisee pour reutiliser silencieusement
     * un dossier existant plutot que d'avertir apres coup. Volontairement plus
     * stricte que findPotentialDuplicates() : ici la reutilisation est
     * automatique, pas soumise au jugement d'un humain, donc pas de tolerance
     * floue. N'essaie meme pas si la date de naissance est inconnue — trop
     * faible comme signal a elle seule pour fusionner sans confirmation.
     */
    public function findExactMatch(string $firstName, string $lastName, ?string $sex, ?string $dateOfBirth): ?Patient
    {
        if (! $dateOfBirth) {
            return null;
        }

        return Patient::query()
            ->whereRaw('unaccent_lower(first_name) = unaccent_lower(?)', [$firstName])
            ->whereRaw('unaccent_lower(last_name) = unaccent_lower(?)', [$lastName])
            ->where('date_of_birth', $dateOfBirth)
            ->where(function ($query) use ($sex) {
                $sex === null ? $query->whereNull('sex') : $query->where('sex', $sex);
            })
            ->first();
    }

    /**
     * Recherche des patients existants dont le nom complet est similaire
     * (pg_trgm, insensible aux accents/casse via unaccent_lower — voir
     * docker/postgres/init.sql). Une date de naissance identique remonte
     * fortement le score, mais n'est pas exigée (elle peut être inconnue).
     */
    public function findPotentialDuplicates(
        string $firstName,
        string $lastName,
        ?string $dateOfBirth = null,
        float $threshold = self::DEFAULT_THRESHOLD,
    ): Collection {
        $fullName = trim("{$firstName} {$lastName}");

        $query = Patient::query()
            ->select('patients.*')
            ->selectRaw(
                'similarity(unaccent_lower(first_name || \' \' || last_name), unaccent_lower(?)) as name_score',
                [$fullName]
            )
            ->whereRaw(
                'similarity(unaccent_lower(first_name || \' \' || last_name), unaccent_lower(?)) > ?',
                [$fullName, $threshold]
            );

        if ($dateOfBirth) {
            $query->orderByRaw('(date_of_birth = ?) desc', [$dateOfBirth]);
        }

        return $query->orderByDesc('name_score')->limit(5)->get();
    }
}
