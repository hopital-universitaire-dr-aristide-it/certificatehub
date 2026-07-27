<?php

namespace Modules\Certificate\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCertificateTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'fee_amount' => ['sometimes', 'numeric', 'min:0'],
            'numbering_prefix' => ['sometimes', 'nullable', 'string', 'max:20'],
            'numbering_next_value' => ['sometimes', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
