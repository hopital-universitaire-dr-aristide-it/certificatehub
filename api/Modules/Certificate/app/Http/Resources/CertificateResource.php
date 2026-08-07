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
            'patient_age' => $this->whenLoaded('patient', fn () => $this->patient->age),
            'certificate_type_id' => $this->certificate_type_id,
            'doctor_id' => $this->doctor_id,
            'doctor_name' => $this->whenLoaded('doctor', fn () => $this->doctor?->name),
            'fee_amount' => (float) $this->fee_amount,
            'certificate_number' => $this->certificate_number,
            'status' => $this->status->value,
            'payment_status' => $this->payment_status->value,
            'paid_at' => $this->paid_at,
            'finalized_at' => $this->finalized_at,
            'manually_printed_at' => $this->manually_printed_at,
            'created_at' => $this->created_at,
            'deleted_at' => $this->deleted_at,
            // Nomme "form_data" et non "data" : Laravel desactive silencieusement
            // l'enveloppe {"data": ...} d'une JsonResource des que son propre
            // tableau contient deja une cle "data" (voir
            // ResourceResponse::haveDefaultWrapperAndDataIsUnwrapped) — piege
            // deja rencontre une fois en construisant cette resource.
            'form_data' => $this->data,
        ];
    }
}
