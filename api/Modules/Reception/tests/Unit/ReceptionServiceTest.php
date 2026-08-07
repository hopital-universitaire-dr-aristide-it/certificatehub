<?php

namespace Modules\Reception\Tests\Unit;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Modules\Certificate\Enums\CertificateStatus;
use Modules\Certificate\Enums\PaymentStatus;
use Modules\Certificate\Models\Certificate;
use Modules\Certificate\Models\CertificateType;
use Modules\Patient\Models\Patient;
use Modules\Reception\Services\ReceptionService;
use Tests\TestCase;

class ReceptionServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_visit_creates_draft_unpaid_certificate_with_fee_snapshot(): void
    {
        $type = CertificateType::factory()->create(['fee_amount' => 650]);
        $patient = Patient::factory()->create();
        $receptionist = User::factory()->create();

        $certificate = (new ReceptionService)->registerVisit($patient->id, $type->id, $receptionist);

        $this->assertSame($patient->id, $certificate->patient_id);
        $this->assertSame($receptionist->id, $certificate->created_by);
        $this->assertEquals(650, $certificate->fee_amount);
        $this->assertSame(PaymentStatus::Unpaid, $certificate->payment_status);
    }

    public function test_register_visit_rejects_inactive_certificate_type(): void
    {
        $type = CertificateType::factory()->create(['is_active' => false]);
        $patient = Patient::factory()->create();
        $receptionist = User::factory()->create();

        $this->expectException(ValidationException::class);

        (new ReceptionService)->registerVisit($patient->id, $type->id, $receptionist);
    }

    public function test_fee_snapshot_survives_later_fee_change(): void
    {
        $type = CertificateType::factory()->create(['fee_amount' => 500]);
        $patient = Patient::factory()->create();
        $receptionist = User::factory()->create();

        $certificate = (new ReceptionService)->registerVisit($patient->id, $type->id, $receptionist);
        $type->update(['fee_amount' => 900]);

        $this->assertEquals(500, $certificate->fresh()->fee_amount);
    }

    public function test_mark_paid_flips_payment_status(): void
    {
        $type = CertificateType::factory()->create();
        $patient = Patient::factory()->create();
        $receptionist = User::factory()->create();
        $service = new ReceptionService;

        $certificate = $service->registerVisit($patient->id, $type->id, $receptionist);
        $paid = $service->markPaid($certificate);

        $this->assertSame(PaymentStatus::Paid, $paid->payment_status);
    }

    public function test_mark_printed_sets_manually_printed_at_on_a_finalized_certificate(): void
    {
        $certificate = Certificate::factory()->create(['status' => CertificateStatus::Finalized]);

        $printed = (new ReceptionService)->markPrinted($certificate);

        $this->assertNotNull($printed->manually_printed_at);
    }

    public function test_mark_printed_rejects_a_non_finalized_certificate(): void
    {
        $certificate = Certificate::factory()->create(['status' => CertificateStatus::Draft]);

        $this->expectException(ValidationException::class);

        (new ReceptionService)->markPrinted($certificate);
    }

    public function test_unmark_printed_clears_manually_printed_at(): void
    {
        $certificate = Certificate::factory()->create([
            'status' => CertificateStatus::Finalized,
            'manually_printed_at' => now(),
        ]);

        $unmarked = (new ReceptionService)->unmarkPrinted($certificate);

        $this->assertNull($unmarked->manually_printed_at);
    }
}
