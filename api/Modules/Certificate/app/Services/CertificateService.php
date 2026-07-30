<?php

namespace Modules\Certificate\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Certificate\Enums\CertificateStatus;
use Modules\Certificate\Enums\PaymentStatus;
use Modules\Certificate\Models\Certificate;
use Modules\FormHub\Enums\FieldType;

class CertificateService
{
    /**
     * Certificats payés, pas encore finalisés — disponibles pour tout médecin.
     * Tri du plus ancien au plus recent (FIFO, premier paye = premier servi) —
     * $patientName sert a retrouver un patient precis sans avoir a parcourir
     * les pages quand le backlog depasse une page.
     */
    public function queue(?string $patientName = null): Builder
    {
        $query = Certificate::with('patient')
            ->where('status', CertificateStatus::Draft)
            ->where('payment_status', PaymentStatus::Paid);

        if ($patientName) {
            $query->whereHas('patient', function ($patientQuery) use ($patientName) {
                $patientQuery->whereRaw(
                    "unaccent_lower(first_name || ' ' || last_name) LIKE unaccent_lower(?)",
                    ['%'.$patientName.'%'],
                );
            });
        }

        return $query->orderBy('created_at');
    }

    /**
     * Remplit les réponses du formulaire. N'accepte que les clés
     * correspondant à un champ actif du formulaire du certificat — les clés
     * inconnues sont silencieusement ignorées plutôt que rejetées, pour ne
     * pas casser la saisie si un champ vient d'être désactivé entre-temps.
     */
    public function fillData(Certificate $certificate, array $submitted, User $doctor): Certificate
    {
        $certificate->update([
            'data' => array_merge($certificate->data ?? [], $this->normalizeFormData($certificate, $submitted)),
            'doctor_id' => $certificate->doctor_id ?? $doctor->id,
        ]);

        return $certificate->fresh();
    }

    /**
     * Edition superadmin "tout-en-un" (voir certificate.manage_all) : type de
     * certificat, medecin assigne et reponses du formulaire — y compris sur
     * un certificat deja finalise. Les infos patient sont geree a part par
     * PatientService, dans le controller : ce service ne doit pas dependre
     * du module Patient au-dela du modele deja utilise par Certificate.
     */
    public function adminUpdate(Certificate $certificate, array $data): Certificate
    {
        if (array_key_exists('certificate_type_id', $data)) {
            $certificate->certificate_type_id = $data['certificate_type_id'];
        }

        if (array_key_exists('doctor_id', $data)) {
            $certificate->doctor_id = $data['doctor_id'];
        }

        $certificate->save();

        if (array_key_exists('data', $data)) {
            $certificate->update([
                'data' => array_merge($certificate->data ?? [], $this->normalizeFormData($certificate->fresh(), $data['data'])),
            ]);
        }

        return $certificate->fresh();
    }

    private function normalizeFormData(Certificate $certificate, array $submitted): array
    {
        $activeFields = $certificate->certificateType->formDefinition->fields()
            ->where('is_active', true)
            ->get()
            ->keyBy('field_key');

        $normalized = [];
        foreach ($submitted as $key => $value) {
            $field = $activeFields->get($key);

            if (! $field) {
                continue;
            }

            $normalized[$key] = $field->field_type === FieldType::Boolean ? (bool) $value : $value;
        }

        return $normalized;
    }

    /**
     * Finalise le certificat : bloque si non payé (règle métier explicite),
     * attribue le numéro (verrouillage pour éviter les doublons sous
     * concurrence) et fige la date de finalisation.
     */
    public function finalize(Certificate $certificate): Certificate
    {
        if ($certificate->payment_status !== PaymentStatus::Paid) {
            throw ValidationException::withMessages([
                'payment_status' => 'Ce certificat ne peut pas être finalisé tant qu\'il n\'est pas payé.',
            ]);
        }

        if ($certificate->status === CertificateStatus::Finalized) {
            throw ValidationException::withMessages([
                'status' => 'Ce certificat est déjà finalisé.',
            ]);
        }

        return DB::transaction(function () use ($certificate) {
            $certificateType = $certificate->certificateType()->lockForUpdate()->first();
            $number = $certificateType->reserveNextNumber();

            $certificate->update([
                'certificate_number' => $number,
                'status' => CertificateStatus::Finalized,
                'finalized_at' => now(),
            ]);

            return $certificate->fresh();
        });
    }

    /**
     * Annule le certificat (corbeille, restaurable). Si le patient avait deja
     * paye, un nouveau certificat brouillon est cree immediatement pour le
     * meme patient/type afin qu'il redevienne visible dans la file d'attente
     * des medecins pour une nouvelle tentative, sans repasser par l'accueil
     * pour payer une seconde fois.
     */
    public function delete(Certificate $certificate): void
    {
        if ($certificate->payment_status === PaymentStatus::Paid) {
            Certificate::create([
                'patient_id' => $certificate->patient_id,
                'certificate_type_id' => $certificate->certificate_type_id,
                'created_by' => $certificate->created_by,
                'fee_amount' => $certificate->fee_amount,
                'status' => CertificateStatus::Draft,
                'payment_status' => PaymentStatus::Paid,
                'paid_at' => now(),
            ]);
        }

        $certificate->delete();
    }

    public function restore(Certificate $certificate): Certificate
    {
        $certificate->restore();

        return $certificate->fresh();
    }
}
