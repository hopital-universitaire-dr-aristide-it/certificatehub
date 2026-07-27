<?php

namespace Modules\FormHub\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReorderFieldsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'ordered_ids' => ['required', 'array', 'min:1'],
            'ordered_ids.*' => ['required', 'uuid', 'exists:form_fields,id'],
        ];
    }
}
