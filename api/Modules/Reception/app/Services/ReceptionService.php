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
     * Enregistre la visite : crée un certificat en brouillon, non payé, avec
     * le tarif du type de certificat figé au moment de la création.
     */
    public function registerVisit(int $patientId, int $certificateTypeId, User $receptionist): Certificate
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
            'payment_status' => PaymentStatus::Unpaid,
        ]);
    }

    public function markPaid(Certificate $certificate): Certificate
    {
        $certificate->update(['payment_status' => PaymentStatus::Paid]);

        return $certificate->fresh();
    }
}
