<?php

namespace Modules\FormHub\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RenameFieldRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'label' => ['required', 'string', 'max:255'],
        ];
    }
}
