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
     */
    public function queue(): Builder
    {
        return Certificate::with('patient')
            ->where('status', CertificateStatus::Draft)
            ->where('payment_status', PaymentStatus::Paid)
            ->orderBy('created_at');
    }

    /**
     * Remplit les réponses du formulaire. N'accepte que les clés
     * correspondant à un champ actif du formulaire du certificat — les clés
     * inconnues sont silencieusement ignorées plutôt que rejetées, pour ne
     * pas casser la saisie si un champ vient d'être désactivé entre-temps.
     */
    public function fillData(Certificate $certificate, array $submitted, User $doctor): Certificate
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

        $certificate->update([
            'data' => array_merge($certificate->data ?? [], $normalized),
            'doctor_id' => $certificate->doctor_id ?? $doctor->id,
        ]);

        return $certificate->fresh();
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
