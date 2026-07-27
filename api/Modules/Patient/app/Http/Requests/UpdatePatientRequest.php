<?php

namespace Modules\Patient\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePatientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['sometimes', 'string', 'max:255'],
            'last_name' => ['sometimes', 'string', 'max:255'],
            'sex' => ['nullable', Rule::in(['M', 'F'])],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'age' => ['nullable', 'integer', 'min:0', 'max:150'],
            'residence' => ['nullable', 'string', 'max:255'],
        ];
    }
}
