<?php

namespace Modules\Certificate\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCertificateTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'form_definition_id' => ['required', 'integer', 'exists:form_definitions,id'],
            'fee_amount' => ['required', 'numeric', 'min:0'],
            'numbering_prefix' => ['nullable', 'string', 'max:20'],
            'numbering_next_value' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
