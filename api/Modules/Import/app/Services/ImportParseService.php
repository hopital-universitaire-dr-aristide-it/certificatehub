<?php

namespace Modules\Import\Services;

use App\Models\User;
use Modules\Import\Support\DoctorName;
use Modules\Patient\Services\DeduplicationService;

class ImportParseService
{
    public function __construct(private readonly DeduplicationService $deduplicationService) {}

    /**
     * Prend le contenu deja decode d'un ImportUpload::raw_json (tableau
     * d'objets {patient, certificate} — voir la tache d'extraction des
     * certificats scannes) et produit 3 listes de previsualisation editables :
     * patients, medecins (dedupliques par nom normalise, rapproches d'un
     * compte existant quand possible) et certificats (references aux lignes
     * patient/medecin par row_id). Rejouable sans effet de bord — la lecture/
     * decodage du fichier et sa persistance ont deja eu lieu au moment du
     * depot (voir ImportController::store) ; la creation reelle des
     * enregistrements se fait dans ImportConfirmService.
     *
     * @param  array<int, mixed>  $decoded
     */
    public function parse(array $decoded): array
    {
        $existingDoctors = User::role('doctor')->get(['id', 'name'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'normalized' => DoctorName::normalize($u->name)]);

        $patients = [];
        $doctors = [];
        $certificates = [];
        $skipped = [];

        foreach ($decoded as $index => $entry) {
            $sourceFile = is_array($entry) ? ($entry['source_file'] ?? "entrée #{$index}") : "entrée #{$index}";

            if (! is_array($entry) || empty($entry['patient']) || empty($entry['certificate'])) {
                $skipped[] = [
                    'source_file' => $sourceFile,
                    'reason' => (is_array($entry) ? ($entry['extraction_notes'] ?? null) : null) ?? 'Données patient ou certificat manquantes.',
                ];

                continue;
            }

            $patientRowId = "p{$index}";
            $p = $entry['patient'];

            $exactDuplicate = $this->deduplicationService->findExactMatch(
                $p['first_name'] ?? '',
                $p['last_name'] ?? '',
                $p['sex'] ?? null,
                $p['date_of_birth'] ?? null,
            );

            $potentialDuplicates = $this->deduplicationService->findPotentialDuplicates(
                $p['first_name'] ?? '',
                $p['last_name'] ?? '',
                $p['date_of_birth'] ?? null,
            );

            $patients[] = [
                'row_id' => $patientRowId,
                'source_file' => $sourceFile,
                'first_name' => $p['first_name'] ?? '',
                'last_name' => $p['last_name'] ?? '',
                'sex' => $p['sex'] ?? null,
                'date_of_birth' => $p['date_of_birth'] ?? null,
                'age' => $p['age'] ?? null,
                'residence' => $p['residence'] ?? null,
                'exact_duplicate_patient_id' => $exactDuplicate?->id,
                'potential_duplicates' => $potentialDuplicates->map(fn ($d) => [
                    'id' => $d->id,
                    'full_name' => $d->full_name,
                    'date_of_birth' => $d->date_of_birth?->toDateString(),
                    'residence' => $d->residence,
                ])->values()->all(),
            ];

            $c = $entry['certificate'];
            $doctorNameRaw = trim((string) ($c['doctor_name'] ?? ''));
            $normalized = DoctorName::normalize($doctorNameRaw);
            $doctorRowId = null;

            if ($normalized !== '') {
                if (! isset($doctors[$normalized])) {
                    $match = $existingDoctors->firstWhere('normalized', $normalized);
                    $doctors[$normalized] = [
                        'row_id' => 'd'.count($doctors),
                        'name' => $doctorNameRaw,
                        'normalized_name' => $normalized,
                        'matched_user_id' => $match['id'] ?? null,
                        'matched_user_name' => $match['name'] ?? null,
                        'action' => $match ? 'existing' : 'create',
                    ];
                }
                $doctorRowId = $doctors[$normalized]['row_id'];
            }

            $certificates[] = [
                'row_id' => "c{$index}",
                'source_file' => $sourceFile,
                'patient_row_id' => $patientRowId,
                'doctor_row_id' => $doctorRowId,
                'exam_date' => $c['exam_date'] ?? null,
                'form_data' => $c['form_data'] ?? [],
            ];
        }

        return [
            'patients' => $patients,
            'doctors' => array_values($doctors),
            'certificates' => $certificates,
            'skipped' => $skipped,
        ];
    }
}
