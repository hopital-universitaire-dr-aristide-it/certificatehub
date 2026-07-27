<?php

namespace Modules\FormHub\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FormDefinitionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'context_key' => $this->context_key,
            'module' => $this->module,
            'label' => $this->label,
            'description' => $this->description,
            'is_active' => $this->is_active,
        ];
    }
}
