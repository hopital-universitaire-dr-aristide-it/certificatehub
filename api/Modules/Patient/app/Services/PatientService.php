<?php

namespace Modules\Patient\Services;

use Illuminate\Support\Collection;
use Modules\Patient\Models\Patient;

class PatientService
{
    public function __construct(private readonly DeduplicationService $deduplicationService) {}

    /**
     * Crée un nouveau mini-dossier patient. Retourne aussi les doublons
     * potentiels détectés (l'accueil décide de continuer ou de réutiliser
     * un dossier existant).
     */
    public function create(array $data, int $createdBy): array
    {
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

    public function checkDuplicates(string $firstName, string $lastName, ?string $dateOfBirth): Collection
    {
        return $this->deduplicationService->findPotentialDuplicates($firstName, $lastName, $dateOfBirth);
    }
}
