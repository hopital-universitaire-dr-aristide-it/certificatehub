<?php

namespace Modules\Certificate\Http\Controllers;

use App\Http\Controllers\Controller;
use Modules\Certificate\Http\Requests\StoreCertificateTypeRequest;
use Modules\Certificate\Http\Requests\UpdateCertificateTypeRequest;
use Modules\Certificate\Http\Resources\CertificateTypeResource;
use Modules\Certificate\Models\CertificateType;

class CertificateTypeController extends Controller
{
    public function index()
    {
        return CertificateTypeResource::collection(CertificateType::with('formDefinition')->get());
    }

    public function store(StoreCertificateTypeRequest $request)
    {
        $type = CertificateType::create($request->validated());

        return new CertificateTypeResource($type->load('formDefinition'));
    }

    public function update(UpdateCertificateTypeRequest $request, CertificateType $certificateType)
    {
        $certificateType->update($request->validated());

        return new CertificateTypeResource($certificateType->fresh('formDefinition'));
    }
}
