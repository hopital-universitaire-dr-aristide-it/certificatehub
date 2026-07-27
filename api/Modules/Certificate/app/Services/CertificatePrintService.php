<?php

namespace Modules\Certificate\Services;

use Barryvdh\DomPDF\Facade\Pdf;
use Modules\Certificate\Models\Certificate;
use Modules\SystemAdmin\Models\Setting;

class CertificatePrintService
{
    private const SIGN_FIELD_KEYS = [
        'sign_contagieux',
        'sign_chronique',
        'sign_debilitant',
        'sign_trouble_mental',
    ];

    /**
     * Génère le PDF du certificat. Le rendu est identique que ce soit la
     * première impression ou une réimpression — aucun filigrane, seul
     * l'appelant (CertificateController) journalise la réimpression.
     */
    public function generate(Certificate $certificate): string
    {
        $pdf = Pdf::loadView('certificate::pdf.certificate-sante', $this->buildViewData($certificate))
            ->setPaper('letter', 'portrait')
            ->setOption(['defaultFont' => 'DejaVu Sans', 'isRemoteEnabled' => false]);

        return $pdf->output();
    }

    /**
     * Extrait pour être testable indépendamment du rendu PDF (les octets
     * PDF compressés par dompdf ne sont pas cherchables en texte brut).
     */
    public function buildViewData(Certificate $certificate): array
    {
        $certificate->loadMissing(['patient', 'doctor', 'certificateType.formDefinition.fields']);

        $data = $certificate->data ?? [];
        $fieldLabels = $certificate->certificateType->formDefinition->fields
            ->pluck('label', 'field_key');

        $checkedSigns = collect(self::SIGN_FIELD_KEYS)
            ->filter(fn ($key) => ($data[$key] ?? false) === true)
            ->map(fn ($key) => $fieldLabels->get($key, $key))
            ->values()
            ->all();

        $patient = $certificate->patient;
        $dobOrAge = $patient->date_of_birth
            ? $patient->date_of_birth->format('d/m/Y')
            : ($patient->age ? "{$patient->age} ans" : '—');

        // "Dr." est déjà imposé par le gabarit ("Je, soussigné, Dr. ...") —
        // on retire un éventuel préfixe déjà présent dans le nom du compte
        // pour éviter "Dr. Dr. Untel" si l'admin l'a saisi avec le titre.
        $doctorName = preg_replace('/^Dr\.?\s+/i', '', $certificate->doctor?->name ?? '—');

        return [
            'certificateNumber' => $certificate->certificate_number,
            'issuedDate' => ($certificate->finalized_at ?? now())->format('d/m/Y'),
            'doctorName' => $doctorName,
            'directeurMedicalName' => Setting::get('directeur_medical_name', 'Directeur Médical'),
            'patient' => [
                'full_name' => $patient->full_name,
                'date_of_birth_or_age' => $dobOrAge,
                'residence' => $patient->residence ?? '—',
                'pronoun' => $patient->pronoun,
            ],
            'outcome' => $data['outcome'] ?? 'sain',
            'checkedSigns' => $checkedSigns,
            'recommandation' => $data['recommandation'] ?? null,
            'recommandationLabel' => $fieldLabels->get('recommandation', 'Recommandations'),
        ];
    }
}
