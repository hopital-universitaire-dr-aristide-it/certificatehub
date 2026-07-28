<?php

namespace Modules\Certificate\Services;

use Barryvdh\DomPDF\Facade\Pdf;
use Modules\Certificate\Models\Certificate;

class InvoiceService
{
    /**
     * Génère la facture/reçu de paiement. Disponible dès que le certificat
     * est marqué payé à l'accueil — n'attend pas la finalisation médicale.
     */
    public function generate(Certificate $certificate): string
    {
        $pdf = Pdf::loadView('certificate::pdf.invoice', $this->buildViewData($certificate))
            ->setPaper('letter', 'portrait')
            ->setOption(['defaultFont' => 'DejaVu Sans', 'isRemoteEnabled' => false]);

        return $pdf->output();
    }

    public function buildViewData(Certificate $certificate): array
    {
        $certificate->loadMissing(['patient', 'certificateType.formDefinition', 'createdBy']);

        return [
            'invoiceNumber' => sprintf('FACT-%06d', $certificate->id),
            'paidDate' => ($certificate->paid_at ?? now())->format('d/m/Y'),
            'patientName' => $certificate->patient->full_name,
            'certificateLabel' => $certificate->certificateType->formDefinition->label,
            'feeAmount' => number_format((float) $certificate->fee_amount, 2, ',', ' '),
            'receivedBy' => $certificate->createdBy?->name ?? '—',
        ];
    }
}
