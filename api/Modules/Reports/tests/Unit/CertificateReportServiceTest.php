<?php

namespace Modules\Reports\Tests\Unit;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Certificate\Enums\PaymentStatus;
use Modules\Certificate\Models\Certificate;
use Modules\Certificate\Models\CertificateType;
use Modules\FormHub\Database\Seeders\CertificatSanteFormSeeder;
use Modules\FormHub\Models\FormDefinition;
use Modules\Reports\Services\CertificateReportService;
use Tests\TestCase;

class CertificateReportServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(CertificatSanteFormSeeder::class);
    }

    private function santeType(): CertificateType
    {
        $form = FormDefinition::where('context_key', 'certificate.sante')->firstOrFail();

        return CertificateType::factory()->create(['form_definition_id' => $form->id]);
    }

    public function test_summary_counts_volume_revenue_and_clinical_breakdown(): void
    {
        $type = $this->santeType();
        $doctor = User::factory()->create(['name' => 'Dr. Test']);

        Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'doctor_id' => $doctor->id,
            'fee_amount' => 500,
            'payment_status' => PaymentStatus::Paid,
            'data' => ['outcome' => 'sain'],
        ]);
        Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'doctor_id' => $doctor->id,
            'fee_amount' => 500,
            'payment_status' => PaymentStatus::Paid,
            'data' => ['outcome' => 'presente_signes', 'sign_contagieux' => true],
        ]);
        Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'doctor_id' => null,
            'payment_status' => PaymentStatus::Unpaid,
            'data' => null,
        ]);

        $summary = (new CertificateReportService)->summary(['period' => 'month']);

        $this->assertSame(3, $summary['volume']['total']);
        $this->assertEquals(1000, $summary['revenue']['total_paid']);
        $this->assertSame(1, $summary['revenue']['unpaid_count']);
        $this->assertSame(1, $summary['clinical']['sain_count']);
        $this->assertSame(1, $summary['clinical']['presente_signes_count']);
        $this->assertSame(1, $summary['clinical']['by_sign']['sign_contagieux']);
    }

    public function test_summary_is_cached(): void
    {
        $type = $this->santeType();
        Certificate::factory()->create(['certificate_type_id' => $type->id, 'payment_status' => PaymentStatus::Paid]);

        $service = new CertificateReportService;
        $first = $service->summary(['period' => 'month']);

        // Un certificat cree apres coup ne doit pas apparaitre tant que le cache n'est pas vide.
        Certificate::factory()->create(['certificate_type_id' => $type->id, 'payment_status' => PaymentStatus::Paid]);
        $second = $service->summary(['period' => 'month']);

        $this->assertSame($first['volume']['total'], $second['volume']['total']);

        $service->flushCache();
        $third = $service->summary(['period' => 'month']);

        $this->assertSame(2, $third['volume']['total']);
    }

    public function test_summary_respects_custom_date_range(): void
    {
        $type = $this->santeType();
        Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'payment_status' => PaymentStatus::Paid,
            'created_at' => now()->subYear(),
        ]);

        $summary = (new CertificateReportService)->summary([
            'period' => 'custom',
            'date_from' => now()->subDay()->toDateString(),
            'date_to' => now()->toDateString(),
        ]);

        $this->assertSame(0, $summary['volume']['total']);
    }
}
