<?php

namespace Modules\FormHub\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SetFieldActiveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'is_active' => ['required', 'boolean'],
        ];
    }
}
