<?php

namespace Modules\Certificate\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CertificateTypeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'form_definition_id' => $this->form_definition_id,
            'form_label' => $this->whenLoaded('formDefinition', fn () => $this->formDefinition->label),
            'is_active' => $this->is_active,
            'fee_amount' => (float) $this->fee_amount,
            'numbering_prefix' => $this->numbering_prefix,
            'numbering_next_value' => $this->numbering_next_value,
        ];
    }
}
