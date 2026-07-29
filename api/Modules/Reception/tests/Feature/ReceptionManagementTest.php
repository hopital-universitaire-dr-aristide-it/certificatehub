<?php

namespace Modules\Reception\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Certificate\Models\Certificate;
use Modules\Certificate\Models\CertificateType;
use Modules\Patient\Models\Patient;
use Modules\SystemAdmin\Database\Seeders\RolesAndPermissionsSeeder;
use Tests\TestCase;

class ReceptionManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_reception_can_register_a_visit(): void
    {
        $patient = Patient::factory()->create();
        $type = CertificateType::factory()->create(['fee_amount' => 500]);
        $reception = $this->userWithRole('reception');

        $response = $this->actingAs($reception, 'sanctum')->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'certificate_type_id' => $type->id,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.payment_status', 'unpaid')
            ->assertJsonPath('data.fee_amount', 500);
        $this->assertDatabaseHas('certificates', ['patient_id' => $patient->id, 'created_by' => $reception->id]);
    }

    public function test_doctor_cannot_register_a_visit(): void
    {
        $patient = Patient::factory()->create();
        $type = CertificateType::factory()->create();
        $doctor = $this->userWithRole('doctor');

        $this->actingAs($doctor, 'sanctum')->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'certificate_type_id' => $type->id,
        ])->assertStatus(403);
    }

    public function test_reception_can_mark_a_visit_paid(): void
    {
        $certificate = Certificate::factory()->create();
        $reception = $this->userWithRole('reception');

        $response = $this->actingAs($reception, 'sanctum')->postJson("/api/v1/visits/{$certificate->id}/mark-paid");

        $response->assertOk()->assertJsonPath('data.payment_status', 'paid');
    }

    public function test_doctor_cannot_mark_a_visit_paid(): void
    {
        $certificate = Certificate::factory()->create();
        $doctor = $this->userWithRole('doctor');

        $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/v1/visits/{$certificate->id}/mark-paid")
            ->assertStatus(403);
    }

    public function test_reception_can_list_visits_filtered_by_payment_status(): void
    {
        Certificate::factory()->count(2)->create();
        Certificate::factory()->create(['payment_status' => 'paid']);
        $reception = $this->userWithRole('reception');

        $response = $this->actingAs($reception, 'sanctum')->getJson('/api/v1/visits?payment_status=paid');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
    }

    public function test_register_visit_validates_patient_and_type_exist(): void
    {
        $reception = $this->userWithRole('reception');

        $this->actingAs($reception, 'sanctum')->postJson('/api/v1/visits', [
            'patient_id' => 999999,
            'certificate_type_id' => 999999,
        ])->assertStatus(422);
    }

    public function test_reception_can_register_a_visit_marked_paid_immediately(): void
    {
        $patient = Patient::factory()->create();
        $type = CertificateType::factory()->create(['fee_amount' => 500]);
        $reception = $this->userWithRole('reception');

        $response = $this->actingAs($reception, 'sanctum')->postJson('/api/v1/visits', [
            'patient_id' => $patient->id,
            'certificate_type_id' => $type->id,
            'mark_paid' => true,
        ]);

        $response->assertCreated()->assertJsonPath('data.payment_status', 'paid');
        $this->assertNotNull($response->json('data.paid_at'));
    }

    public function test_admin_can_cancel_a_payment(): void
    {
        $certificate = Certificate::factory()->create(['payment_status' => 'paid', 'paid_at' => now()]);
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/v1/visits/{$certificate->id}/cancel-payment");

        $response->assertOk()->assertJsonPath('data.payment_status', 'unpaid');
        $this->assertNull($response->json('data.paid_at'));
    }

    public function test_reception_cannot_cancel_a_payment(): void
    {
        $certificate = Certificate::factory()->create(['payment_status' => 'paid']);
        $reception = $this->userWithRole('reception');

        $this->actingAs($reception, 'sanctum')
            ->postJson("/api/v1/visits/{$certificate->id}/cancel-payment")
            ->assertStatus(403);
    }

    public function test_visits_can_be_filtered_by_patient_name(): void
    {
        $match = Patient::factory()->create(['first_name' => 'Jean', 'last_name' => 'Baptiste']);
        $other = Patient::factory()->create(['first_name' => 'Marie', 'last_name' => 'Claire']);
        Certificate::factory()->create(['patient_id' => $match->id]);
        Certificate::factory()->create(['patient_id' => $other->id]);
        $reception = $this->userWithRole('reception');

        $response = $this->actingAs($reception, 'sanctum')->getJson('/api/v1/visits?patient_name=jean');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame($match->id, $response->json('data.0.patient_id'));
    }

    public function test_visits_can_be_filtered_by_date_range(): void
    {
        $reception = $this->userWithRole('reception');
        Certificate::factory()->create(['created_at' => now()->subDays(10)]);
        $recent = Certificate::factory()->create(['created_at' => now()]);

        $response = $this->actingAs($reception, 'sanctum')->getJson('/api/v1/visits?'.http_build_query([
            'date_from' => now()->subDay()->toDateString(),
            'date_to' => now()->addDay()->toDateString(),
        ]));

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame($recent->id, $response->json('data.0.id'));
    }

    public function test_visits_can_be_filtered_by_doctor_name(): void
    {
        $doctorA = User::factory()->create(['name' => 'Dr Aristide']);
        $doctorB = User::factory()->create(['name' => 'Dr Beauvoir']);
        $match = Certificate::factory()->create(['doctor_id' => $doctorA->id]);
        Certificate::factory()->create(['doctor_id' => $doctorB->id]);
        $reception = $this->userWithRole('reception');

        $response = $this->actingAs($reception, 'sanctum')->getJson('/api/v1/visits?doctor_name=aristide');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame($match->id, $response->json('data.0.id'));
        $this->assertSame('Dr Aristide', $response->json('data.0.doctor_name'));
    }
}
