<?php

namespace Modules\Certificate\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminUpdateCertificateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'certificate_type_id' => ['sometimes', 'integer', 'exists:certificate_types,id'],
            'doctor_id' => [
                'sometimes', 'nullable', 'integer', 'exists:users,id',
                function ($attribute, $value, $fail) {
                    if ($value !== null && ! User::find($value)?->hasRole('doctor')) {
                        $fail("L'utilisateur sélectionné n'est pas médecin.");
                    }
                },
            ],
            'data' => ['sometimes', 'array'],
            'patient' => ['sometimes', 'array'],
            'patient.first_name' => ['sometimes', 'string', 'max:255'],
            'patient.last_name' => ['sometimes', 'string', 'max:255'],
            'patient.sex' => ['sometimes', 'nullable', Rule::in(['M', 'F'])],
            'patient.date_of_birth' => ['sometimes', 'nullable', 'date', 'before_or_equal:today'],
            'patient.residence' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
