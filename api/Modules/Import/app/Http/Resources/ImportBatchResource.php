<?php

namespace Modules\Import\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ImportBatchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tag' => $this->tag,
            'patients_count' => $this->whenCounted('patients'),
            'certificates_count' => $this->whenCounted('certificates'),
            'doctors_count' => $this->whenCounted('doctors'),
            'created_at' => $this->created_at,
        ];
    }
}
