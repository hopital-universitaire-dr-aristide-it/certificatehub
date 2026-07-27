<?php

namespace Modules\Certificate\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Modules\Certificate\Enums\CertificateStatus;
use Modules\Certificate\Http\Requests\UpdateCertificateDataRequest;
use Modules\Certificate\Http\Resources\CertificateResource;
use Modules\Certificate\Models\Certificate;
use Modules\Certificate\Models\CertificatePrintLog;
use Modules\Certificate\Services\CertificatePrintService;
use Modules\Certificate\Services\CertificateService;

class CertificateController extends Controller
{
    public function __construct(
        private readonly CertificateService $certificateService,
        private readonly CertificatePrintService $printService,
    ) {}

    /**
     * Certificats payés, en attente d'être remplis/finalisés — tout médecin
     * peut les prendre en charge.
     */
    public function queue()
    {
        return CertificateResource::collection($this->certificateService->queue()->paginate(20));
    }

    public function show(Certificate $certificate)
    {
        return new CertificateResource($certificate->load('patient'));
    }

    public function update(UpdateCertificateDataRequest $request, Certificate $certificate)
    {
        $certificate = $this->certificateService->fillData($certificate, $request->input('data'), $request->user());

        return new CertificateResource($certificate->load('patient'));
    }

    public function finalize(Certificate $certificate)
    {
        $certificate = $this->certificateService->finalize($certificate);

        return new CertificateResource($certificate->load('patient'));
    }

    /**
     * Apercu du rendu — pas de journalisation, utilisable avant finalisation.
     */
    public function preview(Certificate $certificate): Response
    {
        $pdf = $this->printService->generate($certificate);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="apercu-certificat.pdf"',
        ]);
    }

    /**
     * Impression (ou réimpression) — réservé aux certificats finalisés,
     * rendu identique à chaque appel, seule la réimpression est journalisée.
     */
    public function print(Request $request, Certificate $certificate): Response
    {
        if ($certificate->status !== CertificateStatus::Finalized) {
            throw ValidationException::withMessages([
                'status' => 'Ce certificat doit d\'abord être finalisé avant d\'être imprimé.',
            ]);
        }

        $pdf = $this->printService->generate($certificate);

        CertificatePrintLog::create([
            'certificate_id' => $certificate->id,
            'printed_by' => $request->user()->id,
            'printed_at' => now(),
        ]);

        $filename = 'certificat-'.($certificate->certificate_number ?? $certificate->id).'.pdf';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
        ]);
    }
}
