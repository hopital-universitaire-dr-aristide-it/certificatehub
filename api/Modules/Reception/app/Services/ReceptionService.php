<?php

namespace Modules\Reception\Services;

use App\Models\User;
use Illuminate\Validation\ValidationException;
use Modules\Certificate\Enums\CertificateStatus;
use Modules\Certificate\Enums\PaymentStatus;
use Modules\Certificate\Models\Certificate;
use Modules\Certificate\Models\CertificateType;

class ReceptionService
{
    /**
     * Enregistre la visite : crée un certificat en brouillon, avec le tarif
     * du type de certificat figé au moment de la création. Le paiement peut
     * être marqué reçu directement ici ($markPaid) pour éviter à l'accueil
     * un aller-retour supplémentaire dans le tableau des visites.
     */
    public function registerVisit(int $patientId, int $certificateTypeId, User $receptionist, bool $markPaid = false): Certificate
    {
        $certificateType = CertificateType::findOrFail($certificateTypeId);

        if (! $certificateType->is_active) {
            throw ValidationException::withMessages([
                'certificate_type_id' => 'Ce type de certificat n\'est plus actif.',
            ]);
        }

        return Certificate::create([
            'patient_id' => $patientId,
            'certificate_type_id' => $certificateType->id,
            'created_by' => $receptionist->id,
            'fee_amount' => $certificateType->fee_amount,
            'status' => CertificateStatus::Draft,
            'payment_status' => $markPaid ? PaymentStatus::Paid : PaymentStatus::Unpaid,
            'paid_at' => $markPaid ? now() : null,
        ]);
    }

    public function markPaid(Certificate $certificate): Certificate
    {
        $certificate->update(['payment_status' => PaymentStatus::Paid, 'paid_at' => now()]);

        return $certificate->fresh();
    }

    /**
     * Annule un paiement enregistré par erreur — action distincte de
     * l'annulation du certificat lui-même (voir CertificateService::delete),
     * réservée aux rôles de supervision (admin/it/superadmin), jamais à
     * l'accueil qui ne peut que constater un paiement, pas le défaire seul.
     */
    public function cancelPayment(Certificate $certificate): Certificate
    {
        $certificate->update(['payment_status' => PaymentStatus::Unpaid, 'paid_at' => null]);

        return $certificate->fresh();
    }
}
