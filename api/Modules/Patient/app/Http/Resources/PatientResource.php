<?php

namespace Modules\Patient\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'sex' => $this->sex,
            'date_of_birth' => $this->date_of_birth?->toDateString(),
            'age' => $this->age,
            'residence' => $this->residence,
            'created_by' => $this->created_by,
            'import_tag' => $this->whenLoaded('importBatch', fn () => $this->importBatch?->tag),
            'created_at' => $this->created_at,
            'deleted_at' => $this->deleted_at,
        ];
    }
}
