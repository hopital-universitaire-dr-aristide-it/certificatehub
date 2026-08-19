<?php

namespace Modules\Import\Services;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Modules\Certificate\Models\CertificateType;
use Modules\Certificate\Services\CertificateService;
use Modules\Import\Models\ImportBatch;
use Modules\Import\Models\ImportUpload;
use Modules\Import\Support\DoctorName;
use Modules\Patient\Services\PatientService;
use Modules\Reception\Services\ReceptionService;

class ImportConfirmService
{
    public function __construct(
        private readonly PatientService $patientService,
        private readonly ReceptionService $receptionService,
        private readonly CertificateService $certificateService,
    ) {}

    /**
     * Cree en une transaction : le lot (regroupe par texte de tag —
     * firstOrCreate), les comptes medecin manquants, les patients (via
     * PatientService::create, qui reutilise silencieusement un dossier
     * exact-match existant) et les certificats — deja finalises et
     * numerotes, avec finalized_at aligne sur la date d'examen reelle du
     * JSON plutot que la date de l'import. Si $upload est fourni (flux en 2
     * etapes), il est marque complete dans la meme transaction — jamais
     * "a moitie valide" en cas d'echec partiel.
     */
    public function confirm(array $data, User $actor, ?ImportUpload $upload = null): array
    {
        $certificateType = CertificateType::whereHas(
            'formDefinition',
            fn ($q) => $q->where('context_key', 'certificate.sante')
        )->first();

        if (! $certificateType) {
            throw ValidationException::withMessages([
                'certificates' => 'Le type de certificat "Certificat de santé" n\'est pas configuré.',
            ]);
        }

        return DB::transaction(function () use ($data, $actor, $certificateType, $upload) {
            $batch = ImportBatch::firstOrCreate(['tag' => $data['tag']], ['created_by' => $actor->id]);

            [$doctorMap, $doctorsCreated] = $this->resolveDoctors($data['doctors'], $batch);
            [$patientMap, $patientsCreated] = $this->resolvePatients($data['patients'], $actor, $batch);
            $certificatesCreated = $this->createCertificates(
                $data['certificates'],
                $patientMap,
                $doctorMap,
                $certificateType,
                $actor,
                $batch,
            );

            $upload?->update([
                'completed_by' => $actor->id,
                'completed_at' => now(),
                'import_batch_id' => $batch->id,
            ]);

            return [
                'batch' => $batch,
                'doctors_created' => $doctorsCreated,
                'patients_created' => $patientsCreated,
                'certificates_created' => $certificatesCreated,
            ];
        });
    }

    /**
     * @return array{0: array<string, User>, 1: int}
     */
    private function resolveDoctors(array $rows, ImportBatch $batch): array
    {
        $map = [];
        $created = 0;

        foreach ($rows as $row) {
            if ($row['action'] === 'existing') {
                $doctor = User::findOrFail($row['matched_user_id']);

                if (! $doctor->hasRole('doctor')) {
                    throw ValidationException::withMessages([
                        'doctors' => "L'utilisateur sélectionné pour \"{$row['name']}\" n'est pas médecin.",
                    ]);
                }
            } else {
                $doctor = $this->createDoctor($row['name']);
                $doctor->update(['import_batch_id' => $batch->id]);
                $created++;
            }

            $map[$row['row_id']] = $doctor;
        }

        return [$map, $created];
    }

    /**
     * @return array{0: array<string, \Modules\Patient\Models\Patient>, 1: int}
     */
    private function resolvePatients(array $rows, User $actor, ImportBatch $batch): array
    {
        $map = [];
        $created = 0;

        foreach ($rows as $row) {
            $result = $this->patientService->create([
                'first_name' => $row['first_name'],
                'last_name' => $row['last_name'],
                'sex' => $row['sex'] ?? null,
                'date_of_birth' => $row['date_of_birth'] ?? null,
                'age' => $row['age'] ?? null,
                'residence' => $row['residence'] ?? null,
            ], $actor->id);

            $patient = $result['patient'];

            if ($patient->wasRecentlyCreated) {
                $patient->update(['import_batch_id' => $batch->id]);
                $created++;
            }

            $map[$row['row_id']] = $patient;
        }

        return [$map, $created];
    }

    private function createCertificates(
        array $rows,
        array $patientMap,
        array $doctorMap,
        CertificateType $certificateType,
        User $actor,
        ImportBatch $batch,
    ): int {
        $created = 0;

        foreach ($rows as $row) {
            $patient = $patientMap[$row['patient_row_id']] ?? null;
            $doctor = $doctorMap[$row['doctor_row_id']] ?? null;

            if (! $patient || ! $doctor) {
                throw ValidationException::withMessages([
                    'certificates' => "Référence patient ou médecin invalide pour la ligne {$row['row_id']}.",
                ]);
            }

            $certificate = $this->receptionService->registerVisit($patient->id, $certificateType->id, $actor, true);
            $certificate = $this->certificateService->fillData($certificate, $row['form_data'], $doctor);
            $certificate = $this->certificateService->finalize($certificate);

            $certificate->update([
                'finalized_at' => Carbon::parse($row['exam_date']),
                'import_batch_id' => $batch->id,
            ]);

            $created++;
        }

        return $created;
    }

    private function createDoctor(string $name): User
    {
        $slug = DoctorName::slug($name);

        $doctor = User::create([
            'name' => $name,
            'email' => $this->uniqueEmail($slug),
            'password' => Hash::make($slug),
            'is_active' => true,
        ]);
        $doctor->assignRole('doctor');

        return $doctor;
    }

    private function uniqueEmail(string $slug): string
    {
        $email = "{$slug}@gmail.com";
        $suffix = 2;

        while (User::withTrashed()->where('email', $email)->exists()) {
            $email = "{$slug}{$suffix}@gmail.com";
            $suffix++;
        }

        return $email;
    }
}
