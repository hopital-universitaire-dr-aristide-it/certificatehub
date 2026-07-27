<?php

namespace Modules\FormHub\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Variante admin : inclut aussi les champs desactives (pour pouvoir les
 * reactiver depuis le hub), contrairement a FormFieldResource qui ne
 * remonte que l'arbre actif utilise pour le rendu du formulaire.
 */
class FormFieldAdminResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'field_key' => $this->field_key,
            'label' => $this->label,
            'default_label' => $this->default_label,
            'field_type' => $this->field_type->value,
            'is_required' => $this->is_required,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            'config' => $this->config,
            'children' => self::collection($this->whenLoaded('children')),
        ];
    }
}
