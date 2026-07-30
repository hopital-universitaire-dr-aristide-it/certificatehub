<?php

namespace Modules\Certificate\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Modules\Certificate\Enums\CertificateStatus;
use Modules\Certificate\Http\Requests\AdminUpdateCertificateRequest;
use Modules\Certificate\Http\Requests\UpdateCertificateDataRequest;
use Modules\Certificate\Http\Resources\CertificateResource;
use Modules\Certificate\Models\Certificate;
use Modules\Certificate\Models\CertificatePrintLog;
use Modules\Certificate\Services\CertificatePrintService;
use Modules\Certificate\Services\CertificateService;
use Modules\Certificate\Services\InvoiceService;
use Modules\Patient\Services\PatientService;

class CertificateController extends Controller
{
    public function __construct(
        private readonly CertificateService $certificateService,
        private readonly CertificatePrintService $printService,
        private readonly InvoiceService $invoiceService,
        private readonly PatientService $patientService,
    ) {}

    /**
     * Certificats payés, en attente d'être remplis/finalisés — tout médecin
     * peut les prendre en charge. patient_name : recherche sans avoir a
     * parcourir les pages quand le backlog depasse la premiere page.
     */
    public function queue(Request $request)
    {
        $patientName = $request->filled('patient_name') ? $request->string('patient_name')->toString() : null;

        return CertificateResource::collection($this->certificateService->queue($patientName)->paginate(20));
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
     * Edition superadmin "tout-en-un" (voir certificate.manage_all) : corrige
     * en un seul appel les infos du patient (repercutees sur le vrai
     * dossier, pas seulement ce certificat), le medecin assigne, le type de
     * certificat et les reponses du formulaire — y compris sur un certificat
     * deja finalise.
     */
    public function adminUpdate(AdminUpdateCertificateRequest $request, Certificate $certificate)
    {
        $validated = $request->validated();

        if (! empty($validated['patient'])) {
            $this->patientService->update($certificate->patient, $validated['patient']);
        }

        $certificate = $this->certificateService->adminUpdate($certificate, collect($validated)->except('patient')->all());

        return new CertificateResource($certificate->load(['patient', 'doctor']));
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

    /**
     * Facture/recu imprimable — disponible des que le paiement est enregistre
     * a l'accueil, pas besoin d'attendre la finalisation du certificat.
     */
    public function invoice(Certificate $certificate): Response
    {
        $pdf = $this->invoiceService->generate($certificate);

        $filename = 'facture-'.$certificate->id.'.pdf';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
        ]);
    }

    public function destroy(Certificate $certificate)
    {
        $this->certificateService->delete($certificate);

        return response()->noContent();
    }

    public function restore(Certificate $certificate)
    {
        return new CertificateResource($this->certificateService->restore($certificate));
    }

    /**
     * Certificats supprimes (corbeille) — reserve au superadmin, pour retablissement.
     */
    public function trashed()
    {
        return CertificateResource::collection(
            Certificate::onlyTrashed()->with('patient')->orderByDesc('deleted_at')->paginate(20)
        );
    }

    /**
     * Historique des certificats realises par le medecin connecte (pas ceux
     * des autres medecins — voir certificate.view_own, distinct de
     * certificate.view qui donne acces a tous les certificats).
     */
    public function mine(Request $request)
    {
        return CertificateResource::collection(
            Certificate::with('patient')
                ->where('doctor_id', $request->user()->id)
                ->orderByDesc('created_at')
                ->paginate(20)
        );
    }
}
