<?php

namespace Modules\FormHub\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\FormHub\Enums\FieldType;

class StoreFormFieldRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'field_key' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9_]+$/'],
            'label' => ['required', 'string', 'max:255'],
            'field_type' => ['required', Rule::in(array_column(FieldType::cases(), 'value'))],
            'parent_field_id' => ['nullable', 'uuid', 'exists:form_fields,id'],
            'is_required' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
            'config' => ['sometimes', 'array'],
        ];
    }
}
