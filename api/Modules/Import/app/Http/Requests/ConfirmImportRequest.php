<?php

namespace Modules\Import\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ConfirmImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tag' => ['required', 'string', 'max:255'],

            'doctors' => ['required', 'array', 'min:1'],
            'doctors.*.row_id' => ['required', 'string'],
            'doctors.*.name' => ['required', 'string', 'max:255'],
            'doctors.*.action' => ['required', Rule::in(['existing', 'create'])],
            'doctors.*.matched_user_id' => ['nullable', 'integer', 'exists:users,id'],

            'patients' => ['required', 'array', 'min:1'],
            'patients.*.row_id' => ['required', 'string'],
            'patients.*.first_name' => ['required', 'string', 'max:255'],
            'patients.*.last_name' => ['required', 'string', 'max:255'],
            'patients.*.sex' => ['nullable', Rule::in(['M', 'F'])],
            'patients.*.date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'patients.*.age' => ['nullable', 'integer', 'min:0', 'max:150'],
            'patients.*.residence' => ['nullable', 'string', 'max:255'],

            'certificates' => ['required', 'array', 'min:1'],
            'certificates.*.row_id' => ['required', 'string'],
            'certificates.*.patient_row_id' => ['required', 'string'],
            'certificates.*.doctor_row_id' => ['required', 'string'],
            'certificates.*.exam_date' => ['required', 'date', 'before_or_equal:today'],
            'certificates.*.form_data' => ['required', 'array'],
        ];
    }
}
