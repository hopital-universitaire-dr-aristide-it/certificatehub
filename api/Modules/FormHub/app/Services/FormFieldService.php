<?php

namespace Modules\FormHub\Services;

use App\Models\User;
use Modules\FormHub\Models\FormDefinition;
use Modules\FormHub\Models\FormField;

class FormFieldService
{
    /**
     * Renomme le libellé affiché (jamais field_key, immuable — voir ADR-020).
     */
    public function rename(FormField $field, string $label): FormField
    {
        $field->update(['label' => $label]);

        return $field->fresh();
    }

    public function resetLabel(FormField $field): FormField
    {
        $field->update(['label' => $field->default_label]);

        return $field->fresh();
    }

    /**
     * Désactivation = masque des nouvelles saisies, ne supprime jamais la
     * ligne ni les données JSONB déjà saisies sous cette clé.
     */
    public function setActive(FormField $field, bool $active): FormField
    {
        $field->update(['is_active' => $active]);

        return $field->fresh();
    }

    /**
     * Réordonne les champs de même parent (glisser-déposer côté admin).
     * $orderedIds doit contenir tous les frères du même parent_field_id.
     */
    public function reorder(array $orderedIds): void
    {
        foreach ($orderedIds as $index => $id) {
            FormField::where('id', $id)->update(['sort_order' => $index]);
        }
    }

    public function createField(FormDefinition $form, array $data, User $creator): FormField
    {
        return FormField::create([
            'form_id' => $form->id,
            'parent_field_id' => $data['parent_field_id'] ?? null,
            'field_key' => $data['field_key'],
            'default_label' => $data['label'],
            'label' => $data['label'],
            'field_type' => $data['field_type'],
            'is_required' => $data['is_required'] ?? false,
            'sort_order' => $data['sort_order'] ?? 0,
            'config' => $data['config'] ?? null,
            'created_by' => $creator->id,
        ]);
    }
}
