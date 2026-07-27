<?php

namespace Modules\Certificate\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CertificateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'patient_id' => $this->patient_id,
            'patient_name' => $this->whenLoaded('patient', fn () => $this->patient->full_name),
            'certificate_type_id' => $this->certificate_type_id,
            'doctor_id' => $this->doctor_id,
            'fee_amount' => (float) $this->fee_amount,
            'certificate_number' => $this->certificate_number,
            'status' => $this->status->value,
            'payment_status' => $this->payment_status->value,
            'finalized_at' => $this->finalized_at,
            'created_at' => $this->created_at,
        ];
    }
}
