<?php

namespace Modules\Reception\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Certificate\Http\Resources\CertificateResource;
use Modules\Certificate\Models\Certificate;
use Modules\Reception\Http\Requests\RegisterVisitRequest;
use Modules\Reception\Services\ReceptionService;

class ReceptionController extends Controller
{
    public function __construct(private readonly ReceptionService $receptionService) {}

    public function index(Request $request)
    {
        $query = Certificate::with('patient')->orderByDesc('created_at');

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->string('payment_status')->toString());
        }

        return CertificateResource::collection($query->paginate(20));
    }

    public function store(RegisterVisitRequest $request)
    {
        $certificate = $this->receptionService->registerVisit(
            $request->integer('patient_id'),
            $request->integer('certificate_type_id'),
            $request->user(),
        );

        return new CertificateResource($certificate->load('patient'));
    }

    public function markPaid(Certificate $certificate)
    {
        return new CertificateResource($this->receptionService->markPaid($certificate)->load('patient'));
    }
}
