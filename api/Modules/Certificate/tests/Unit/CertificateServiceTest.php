<?php

namespace Modules\Certificate\Tests\Unit;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Modules\Certificate\Enums\CertificateStatus;
use Modules\Certificate\Enums\PaymentStatus;
use Modules\Certificate\Models\Certificate;
use Modules\Certificate\Models\CertificateType;
use Modules\Certificate\Services\CertificateService;
use Modules\FormHub\Database\Seeders\CertificatSanteFormSeeder;
use Modules\FormHub\Models\FormDefinition;
use Tests\TestCase;

class CertificateServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(CertificatSanteFormSeeder::class);
    }

    private function santeType(array $overrides = []): CertificateType
    {
        $form = FormDefinition::where('context_key', 'certificate.sante')->firstOrFail();

        return CertificateType::factory()->create(array_merge(['form_definition_id' => $form->id], $overrides));
    }

    public function test_queue_only_returns_paid_draft_certificates(): void
    {
        $type = $this->santeType();
        Certificate::factory()->create(['certificate_type_id' => $type->id, 'payment_status' => PaymentStatus::Unpaid]);
        $paid = Certificate::factory()->create(['certificate_type_id' => $type->id, 'payment_status' => PaymentStatus::Paid]);
        Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'payment_status' => PaymentStatus::Paid,
            'status' => CertificateStatus::Finalized,
        ]);

        $queue = (new CertificateService)->queue()->get();

        $this->assertCount(1, $queue);
        $this->assertSame($paid->id, $queue->first()->id);
    }

    public function test_fill_data_normalizes_booleans_and_ignores_unknown_keys(): void
    {
        $type = $this->santeType();
        $certificate = Certificate::factory()->create(['certificate_type_id' => $type->id]);
        $doctor = User::factory()->create();

        $updated = (new CertificateService)->fillData($certificate, [
            'sign_contagieux' => '1',
            'sign_chronique' => 0,
            'not_a_real_field' => 'ignored',
            'recommandation' => 'Repos',
        ], $doctor);

        $this->assertTrue($updated->data['sign_contagieux']);
        $this->assertFalse($updated->data['sign_chronique']);
        $this->assertArrayNotHasKey('not_a_real_field', $updated->data);
        $this->assertSame('Repos', $updated->data['recommandation']);
        $this->assertSame($doctor->id, $updated->doctor_id);
    }

    public function test_fill_data_ignores_inactive_fields(): void
    {
        $type = $this->santeType();
        $certificate = Certificate::factory()->create(['certificate_type_id' => $type->id]);
        $doctor = User::factory()->create();
        $type->formDefinition->fields()->where('field_key', 'sign_contagieux')->update(['is_active' => false]);

        $updated = (new CertificateService)->fillData($certificate, ['sign_contagieux' => true], $doctor);

        $this->assertArrayNotHasKey('sign_contagieux', $updated->data ?? []);
    }

    public function test_finalize_rejects_unpaid_certificate(): void
    {
        $type = $this->santeType();
        $certificate = Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'payment_status' => PaymentStatus::Unpaid,
        ]);

        $this->expectException(ValidationException::class);

        (new CertificateService)->finalize($certificate);
    }

    public function test_finalize_rejects_already_finalized_certificate(): void
    {
        $type = $this->santeType();
        $certificate = Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'payment_status' => PaymentStatus::Paid,
            'status' => CertificateStatus::Finalized,
        ]);

        $this->expectException(ValidationException::class);

        (new CertificateService)->finalize($certificate);
    }

    public function test_finalize_assigns_sequential_numbers_with_prefix(): void
    {
        $type = $this->santeType(['numbering_prefix' => 'CS', 'numbering_next_value' => 42]);
        $certificate = Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $finalized = (new CertificateService)->finalize($certificate);

        $this->assertSame('CS-000042', $finalized->certificate_number);
        $this->assertSame(43, $type->fresh()->numbering_next_value);
        $this->assertSame(CertificateStatus::Finalized, $finalized->status);
        $this->assertNotNull($finalized->finalized_at);
    }
}
