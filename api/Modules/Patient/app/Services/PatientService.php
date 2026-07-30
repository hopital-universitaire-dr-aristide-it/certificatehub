<?php

namespace Modules\Patient\Services;

use Illuminate\Support\Collection;
use Modules\Patient\Models\Patient;

class PatientService
{
    public function __construct(private readonly DeduplicationService $deduplicationService) {}

    /**
     * Crée un nouveau mini-dossier patient — sauf si un dossier correspond
     * déjà exactement (nom, prénom, sexe, date de naissance) : dans ce cas on
     * le réutilise directement plutôt que de créer un doublon silencieux (voir
     * DeduplicationService::findExactMatch). Retourne aussi les doublons
     * potentiels détectés par ressemblance floue quand un nouveau dossier est
     * bien créé, pour que l'accueil puisse encore juger au cas par cas.
     */
    public function create(array $data, int $createdBy): array
    {
        $existing = $this->deduplicationService->findExactMatch(
            $data['first_name'],
            $data['last_name'],
            $data['sex'] ?? null,
            $data['date_of_birth'] ?? null,
        );

        if ($existing) {
            return ['patient' => $existing, 'potential_duplicates' => collect()];
        }

        $duplicates = $this->deduplicationService->findPotentialDuplicates(
            $data['first_name'],
            $data['last_name'],
            $data['date_of_birth'] ?? null,
        );

        $patient = Patient::create([...$data, 'created_by' => $createdBy]);

        return ['patient' => $patient, 'potential_duplicates' => $duplicates];
    }

    public function update(Patient $patient, array $data): Patient
    {
        $patient->update($data);

        return $patient->fresh();
    }

    public function delete(Patient $patient): void
    {
        $patient->delete();
    }

    public function restore(Patient $patient): Patient
    {
        $patient->restore();

        return $patient->fresh();
    }

    public function checkDuplicates(string $firstName, string $lastName, ?string $dateOfBirth): Collection
    {
        return $this->deduplicationService->findPotentialDuplicates($firstName, $lastName, $dateOfBirth);
    }
}
