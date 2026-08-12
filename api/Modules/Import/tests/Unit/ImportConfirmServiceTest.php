<?php

namespace Modules\Import\Tests\Unit;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Modules\Certificate\Enums\CertificateStatus;
use Modules\Certificate\Enums\PaymentStatus;
use Modules\Certificate\Models\Certificate;
use Modules\Certificate\Models\CertificateType;
use Modules\FormHub\Database\Seeders\CertificatSanteFormSeeder;
use Modules\FormHub\Models\FormDefinition;
use Modules\Import\Models\ImportBatch;
use Modules\Import\Services\ImportConfirmService;
use Modules\Patient\Models\Patient;
use Modules\SystemAdmin\Database\Seeders\RolesAndPermissionsSeeder;
use Tests\TestCase;

class ImportConfirmServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(CertificatSanteFormSeeder::class);

        $form = FormDefinition::where('context_key', 'certificate.sante')->firstOrFail();
        CertificateType::factory()->create(['form_definition_id' => $form->id]);
    }

    private function payload(array $overrides = []): array
    {
        return array_replace_recursive([
            'tag' => 'Lot Test',
            'doctors' => [
                ['row_id' => 'd0', 'name' => 'Jean Pierre', 'action' => 'create', 'matched_user_id' => null],
            ],
            'patients' => [
                [
                    'row_id' => 'p0',
                    'first_name' => 'Marie',
                    'last_name' => 'Joseph',
                    'sex' => null,
                    'date_of_birth' => '2000-01-01',
                    'age' => null,
                    'residence' => 'Delmas',
                ],
            ],
            'certificates' => [
                [
                    'row_id' => 'c0',
                    'patient_row_id' => 'p0',
                    'doctor_row_id' => 'd0',
                    'exam_date' => '2026-08-01',
                    'form_data' => [
                        'outcome' => 'sain',
                        'sign_contagieux' => false,
                        'sign_chronique' => false,
                        'sign_debilitant' => false,
                        'sign_trouble_mental' => false,
                    ],
                ],
            ],
        ], $overrides);
    }

    public function test_confirm_creates_patient_doctor_and_finalized_certificate(): void
    {
        $actor = User::factory()->create();

        $result = app(ImportConfirmService::class)->confirm($this->payload(), $actor);

        $this->assertSame(1, $result['doctors_created']);
        $this->assertSame(1, $result['patients_created']);
        $this->assertSame(1, $result['certificates_created']);

        $doctor = User::where('name', 'Jean Pierre')->firstOrFail();
        $this->assertSame('jeanpierre@gmail.com', $doctor->email);
        $this->assertTrue(Hash::check('jeanpierre', $doctor->password));
        $this->assertTrue($doctor->hasRole('doctor'));
        $this->assertSame($result['batch']->id, $doctor->import_batch_id);

        $patient = Patient::where('first_name', 'Marie')->firstOrFail();
        $this->assertSame($result['batch']->id, $patient->import_batch_id);

        $certificate = Certificate::where('patient_id', $patient->id)->firstOrFail();
        $this->assertSame(CertificateStatus::Finalized, $certificate->status);
        $this->assertSame(PaymentStatus::Paid, $certificate->payment_status);
        $this->assertNotNull($certificate->certificate_number);
        $this->assertSame($doctor->id, $certificate->doctor_id);
        $this->assertSame('2026-08-01', $certificate->finalized_at->toDateString());
        $this->assertSame($result['batch']->id, $certificate->import_batch_id);
    }

    public function test_confirm_reuses_an_existing_doctor_without_creating_a_new_account(): void
    {
        $existingDoctor = User::factory()->create(['name' => 'Salomon']);
        $existingDoctor->assignRole('doctor');
        $actor = User::factory()->create();

        $payload = $this->payload([
            'doctors' => [
                ['row_id' => 'd0', 'name' => 'Salomon', 'action' => 'existing', 'matched_user_id' => $existingDoctor->id],
            ],
        ]);

        $result = app(ImportConfirmService::class)->confirm($payload, $actor);

        $this->assertSame(0, $result['doctors_created']);
        $this->assertNull($existingDoctor->fresh()->import_batch_id);

        $certificate = Certificate::firstOrFail();
        $this->assertSame($existingDoctor->id, $certificate->doctor_id);
    }

    public function test_confirm_rejects_an_existing_doctor_row_without_the_doctor_role(): void
    {
        $notADoctor = User::factory()->create();
        $actor = User::factory()->create();

        $payload = $this->payload([
            'doctors' => [
                ['row_id' => 'd0', 'name' => 'Salomon', 'action' => 'existing', 'matched_user_id' => $notADoctor->id],
            ],
        ]);

        $this->expectException(ValidationException::class);

        app(ImportConfirmService::class)->confirm($payload, $actor);
    }

    public function test_confirm_reuses_an_exact_match_patient_instead_of_duplicating(): void
    {
        $existing = Patient::factory()->create([
            'first_name' => 'Marie',
            'last_name' => 'Joseph',
            'sex' => null,
            'date_of_birth' => '2000-01-01',
        ]);
        $actor = User::factory()->create();

        $result = app(ImportConfirmService::class)->confirm($this->payload(), $actor);

        $this->assertSame(0, $result['patients_created']);
        $this->assertSame(1, Patient::count());
        $this->assertNull($existing->fresh()->import_batch_id);

        $certificate = Certificate::firstOrFail();
        $this->assertSame($existing->id, $certificate->patient_id);
    }

    public function test_confirm_generates_a_unique_email_on_collision(): void
    {
        User::factory()->create(['email' => 'jeanpierre@gmail.com']);
        $actor = User::factory()->create();

        app(ImportConfirmService::class)->confirm($this->payload(), $actor);

        $doctor = User::where('name', 'Jean Pierre')->firstOrFail();
        $this->assertSame('jeanpierre2@gmail.com', $doctor->email);
    }

    public function test_confirm_groups_batches_with_the_same_tag(): void
    {
        $actor = User::factory()->create();

        $first = app(ImportConfirmService::class)->confirm($this->payload(), $actor);

        $second = app(ImportConfirmService::class)->confirm($this->payload([
            'doctors' => [
                ['row_id' => 'd0', 'name' => 'Autre Medecin', 'action' => 'create', 'matched_user_id' => null],
            ],
            'patients' => [
                [
                    'row_id' => 'p0',
                    'first_name' => 'Autre',
                    'last_name' => 'Patient',
                    'sex' => null,
                    'date_of_birth' => '2001-02-02',
                    'age' => null,
                    'residence' => 'Carrefour',
                ],
            ],
        ]), $actor);

        $this->assertSame($first['batch']->id, $second['batch']->id);
        $this->assertSame(1, ImportBatch::count());
    }
}
