<?php

namespace Modules\FormHub\Http\Controllers;

use App\Http\Controllers\Controller;
use Modules\FormHub\Http\Requests\RenameFieldRequest;
use Modules\FormHub\Http\Requests\ReorderFieldsRequest;
use Modules\FormHub\Http\Requests\SetFieldActiveRequest;
use Modules\FormHub\Http\Requests\StoreFormFieldRequest;
use Modules\FormHub\Http\Resources\FormFieldAdminResource;
use Modules\FormHub\Models\FormDefinition;
use Modules\FormHub\Models\FormField;
use Modules\FormHub\Services\FormFieldService;

class FormFieldController extends Controller
{
    public function __construct(private readonly FormFieldService $formFieldService) {}

    public function store(StoreFormFieldRequest $request, FormDefinition $formDefinition)
    {
        $field = $this->formFieldService->createField($formDefinition, $request->validated(), $request->user());

        return new FormFieldAdminResource($field);
    }

    public function rename(RenameFieldRequest $request, FormField $formField)
    {
        return new FormFieldAdminResource(
            $this->formFieldService->rename($formField, $request->string('label')->toString())
        );
    }

    public function resetLabel(FormField $formField)
    {
        return new FormFieldAdminResource($this->formFieldService->resetLabel($formField));
    }

    public function setActive(SetFieldActiveRequest $request, FormField $formField)
    {
        return new FormFieldAdminResource(
            $this->formFieldService->setActive($formField, $request->boolean('is_active'))
        );
    }

    public function reorder(ReorderFieldsRequest $request)
    {
        $this->formFieldService->reorder($request->input('ordered_ids'));

        return response()->json(['message' => 'Ordre mis à jour.']);
    }
}
