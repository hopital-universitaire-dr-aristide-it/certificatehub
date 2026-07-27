<?php

namespace Modules\Certificate\Tests\Unit;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Certificate\Models\Certificate;
use Modules\Certificate\Models\CertificateType;
use Modules\Certificate\Services\CertificatePrintService;
use Modules\FormHub\Database\Seeders\CertificatSanteFormSeeder;
use Modules\FormHub\Models\FormDefinition;
use Modules\Patient\Models\Patient;
use Modules\SystemAdmin\Models\Setting;
use Tests\TestCase;

class CertificatePrintServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(CertificatSanteFormSeeder::class);
        Setting::set('directeur_medical_name', 'Dr. Joseph Edmond Pierre');
    }

    private function makeCertificate(array $overrides = []): Certificate
    {
        $form = FormDefinition::where('context_key', 'certificate.sante')->firstOrFail();
        $type = CertificateType::factory()->create(['form_definition_id' => $form->id]);
        $patient = Patient::factory()->create(['first_name' => 'Marie', 'last_name' => 'Joseph']);
        $doctor = User::factory()->create(['name' => 'Dr. Robert Casimir']);

        return Certificate::factory()->create(array_merge([
            'certificate_type_id' => $type->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'data' => ['outcome' => 'sain'],
        ], $overrides));
    }

    public function test_generate_returns_a_valid_pdf(): void
    {
        $certificate = $this->makeCertificate();

        $pdf = (new CertificatePrintService)->generate($certificate);

        $this->assertStringStartsWith('%PDF', $pdf);
    }

    public function test_view_data_strips_duplicate_dr_prefix_from_doctor_name(): void
    {
        $certificate = $this->makeCertificate();
        $certificate->doctor->update(['name' => 'Dr. Robert Casimir']);

        $viewData = (new CertificatePrintService)->buildViewData($certificate->fresh());

        $this->assertSame('Robert Casimir', $viewData['doctorName']);
    }

    public function test_view_data_includes_checked_signs_with_current_labels(): void
    {
        $certificate = $this->makeCertificate([
            'data' => ['outcome' => 'presente_signes', 'sign_contagieux' => true],
        ]);

        $viewData = (new CertificatePrintService)->buildViewData($certificate);

        $this->assertContains('Signes évocateurs de maladies contagieuses ou transmissibles', $viewData['checkedSigns']);
    }

    public function test_view_data_uses_configurable_directeur_medical_name(): void
    {
        Setting::set('directeur_medical_name', 'Dr. Une Autre Personne');
        $certificate = $this->makeCertificate();

        $viewData = (new CertificatePrintService)->buildViewData($certificate);

        $this->assertSame('Dr. Une Autre Personne', $viewData['directeurMedicalName']);
    }

    public function test_view_data_includes_patient_pronoun_based_on_sex(): void
    {
        $certificate = $this->makeCertificate();
        $certificate->patient->update(['sex' => 'F']);

        $viewData = (new CertificatePrintService)->buildViewData($certificate->fresh());

        $this->assertSame('elle', $viewData['patient']['pronoun']);
    }
}
