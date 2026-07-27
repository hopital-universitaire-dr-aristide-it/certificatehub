<?php

namespace Modules\Patient\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Version allegee pour les listes / suggestions d'autocomplete.
 */
class PatientSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'full_name' => $this->full_name,
            'date_of_birth' => $this->date_of_birth?->toDateString(),
            'residence' => $this->residence,
        ];
    }
}
