<?php

namespace Modules\Import\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreImportUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file'],
            'tag' => ['required', 'string', 'max:255'],
        ];
    }
}
