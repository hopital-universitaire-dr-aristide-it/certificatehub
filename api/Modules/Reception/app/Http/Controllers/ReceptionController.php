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

    /**
     * Reutilise a la fois par l'accueil (ses propres visites du jour, et
     * l'ecran "Consulter certificats" avec filtres nom/medecin/date) et par
     * l'ecran d'oversight admin/it (filtres nom/date en plus).
     */
    public function index(Request $request)
    {
        $query = Certificate::with(['patient', 'doctor', 'importBatch'])->orderByDesc('created_at');

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->string('payment_status')->toString());
        }

        if ($request->filled('patient_name')) {
            $name = $request->string('patient_name')->toString();
            $query->whereHas('patient', function ($patientQuery) use ($name) {
                $patientQuery->whereRaw(
                    "unaccent_lower(first_name || ' ' || last_name) LIKE unaccent_lower(?)",
                    ['%'.$name.'%'],
                );
            });
        }

        if ($request->filled('doctor_name')) {
            $name = $request->string('doctor_name')->toString();
            $query->whereHas('doctor', function ($doctorQuery) use ($name) {
                $doctorQuery->whereRaw('unaccent_lower(name) LIKE unaccent_lower(?)', ['%'.$name.'%']);
            });
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date('date_to'));
        }

        if ($request->filled('printed')) {
            $query->when(
                $request->boolean('printed'),
                fn ($q) => $q->whereNotNull('manually_printed_at'),
                fn ($q) => $q->whereNull('manually_printed_at'),
            );
        }

        if ($request->filled('import_tag')) {
            $tag = $request->string('import_tag')->toString();
            $query->whereHas('importBatch', fn ($batchQuery) => $batchQuery->where('tag', $tag));
        }

        return CertificateResource::collection($query->paginate(20));
    }

    public function store(RegisterVisitRequest $request)
    {
        $certificate = $this->receptionService->registerVisit(
            $request->integer('patient_id'),
            $request->integer('certificate_type_id'),
            $request->user(),
            $request->boolean('mark_paid'),
        );

        return new CertificateResource($certificate->load('patient'));
    }

    public function markPaid(Certificate $certificate)
    {
        return new CertificateResource($this->receptionService->markPaid($certificate)->load('patient'));
    }

    /**
     * Annule un paiement enregistre par erreur — reserve aux roles de
     * supervision (voir certificate.cancel_payment dans le seeder de roles).
     */
    public function cancelPayment(Certificate $certificate)
    {
        return new CertificateResource($this->receptionService->cancelPayment($certificate)->load('patient'));
    }

    public function markPrinted(Certificate $certificate)
    {
        return new CertificateResource($this->receptionService->markPrinted($certificate)->load('patient'));
    }

    public function unmarkPrinted(Certificate $certificate)
    {
        return new CertificateResource($this->receptionService->unmarkPrinted($certificate)->load('patient'));
    }
}
