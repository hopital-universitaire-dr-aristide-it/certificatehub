<?php

namespace Modules\Reception\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterVisitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'certificate_type_id' => ['required', 'integer', 'exists:certificate_types,id'],
        ];
    }
}
