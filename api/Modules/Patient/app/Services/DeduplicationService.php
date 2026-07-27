<?php

namespace Modules\Patient\Services;

use Illuminate\Support\Collection;
use Modules\Patient\Models\Patient;

class DeduplicationService
{
    private const DEFAULT_THRESHOLD = 0.4;

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
