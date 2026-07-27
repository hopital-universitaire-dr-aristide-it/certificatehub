<?php

namespace Modules\Certificate\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCertificateDataRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'data' => ['required', 'array'],
        ];
    }
}
