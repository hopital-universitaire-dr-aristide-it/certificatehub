<?php

namespace Modules\Certificate\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Certificate\Enums\PaymentStatus;
use Modules\Certificate\Models\Certificate;
use Modules\Certificate\Models\CertificateType;
use Modules\FormHub\Database\Seeders\CertificatSanteFormSeeder;
use Modules\FormHub\Models\FormDefinition;
use Modules\SystemAdmin\Database\Seeders\RolesAndPermissionsSeeder;
use Tests\TestCase;

class CertificateWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(CertificatSanteFormSeeder::class);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function santeType(): CertificateType
    {
        $form = FormDefinition::where('context_key', 'certificate.sante')->firstOrFail();

        return CertificateType::factory()->create(['form_definition_id' => $form->id]);
    }

    public function test_doctor_sees_only_paid_drafts_in_queue(): void
    {
        $type = $this->santeType();
        Certificate::factory()->create(['certificate_type_id' => $type->id, 'payment_status' => PaymentStatus::Unpaid]);
        $paid = Certificate::factory()->create(['certificate_type_id' => $type->id, 'payment_status' => PaymentStatus::Paid]);
        $doctor = $this->userWithRole('doctor');

        $response = $this->actingAs($doctor, 'sanctum')->getJson('/api/v1/certificates/queue');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame($paid->id, $response->json('data.0.id'));
    }

    public function test_reception_cannot_access_doctor_queue(): void
    {
        $reception = $this->userWithRole('reception');

        $this->actingAs($reception, 'sanctum')->getJson('/api/v1/certificates/queue')->assertStatus(403);
    }

    public function test_doctor_can_fill_and_finalize_but_not_print(): void
    {
        $type = $this->santeType();
        $certificate = Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'payment_status' => PaymentStatus::Paid,
        ]);
        $doctor = $this->userWithRole('doctor');

        $this->actingAs($doctor, 'sanctum')->putJson("/api/v1/certificates/{$certificate->id}", [
            'data' => ['outcome' => 'sain'],
        ])->assertOk();

        $finalize = $this->actingAs($doctor, 'sanctum')->postJson("/api/v1/certificates/{$certificate->id}/finalize");
        $finalize->assertOk()->assertJsonPath('data.status', 'finalized');
        $this->assertNotNull($finalize->json('data.certificate_number'));

        // L'impression est reservee a l'accueil/l'admin — le medecin ne peut que previsualiser.
        $this->actingAs($doctor, 'sanctum')->get("/api/v1/certificates/{$certificate->id}/print")->assertStatus(403);
        $this->assertDatabaseCount('certificate_print_log', 0);
    }

    public function test_reception_and_admin_can_print_a_finalized_certificate(): void
    {
        $type = $this->santeType();
        $certificate = Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'payment_status' => PaymentStatus::Paid,
            'data' => ['outcome' => 'sain'],
        ]);
        $doctor = $this->userWithRole('doctor');
        $this->actingAs($doctor, 'sanctum')->postJson("/api/v1/certificates/{$certificate->id}/finalize")->assertOk();

        $reception = $this->userWithRole('reception');
        $print = $this->actingAs($reception, 'sanctum')->get("/api/v1/certificates/{$certificate->id}/print");
        $print->assertOk();
        $this->assertSame('application/pdf', $print->headers->get('Content-Type'));
        $this->assertDatabaseCount('certificate_print_log', 1);

        // Reimpression par l'admin : autorisee, journalisee une deuxieme fois, aucun filigrane distinctif attendu.
        $admin = $this->userWithRole('admin');
        $this->actingAs($admin, 'sanctum')->get("/api/v1/certificates/{$certificate->id}/print")->assertOk();
        $this->assertDatabaseCount('certificate_print_log', 2);
    }

    public function test_finalize_is_blocked_when_unpaid(): void
    {
        $type = $this->santeType();
        $certificate = Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'payment_status' => PaymentStatus::Unpaid,
        ]);
        $doctor = $this->userWithRole('doctor');

        $this->actingAs($doctor, 'sanctum')
            ->postJson("/api/v1/certificates/{$certificate->id}/finalize")
            ->assertStatus(422);
    }

    public function test_preview_works_before_finalization(): void
    {
        $type = $this->santeType();
        $certificate = Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'payment_status' => PaymentStatus::Paid,
            'data' => ['outcome' => 'sain'],
        ]);
        $doctor = $this->userWithRole('doctor');

        $response = $this->actingAs($doctor, 'sanctum')->get("/api/v1/certificates/{$certificate->id}/preview");

        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $this->assertDatabaseCount('certificate_print_log', 0);
    }

    public function test_reception_cannot_print_before_finalizing(): void
    {
        $type = $this->santeType();
        $certificate = Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'payment_status' => PaymentStatus::Paid,
            'data' => ['outcome' => 'sain'],
        ]);
        $reception = $this->userWithRole('reception');

        $response = $this->actingAs($reception, 'sanctum')->getJson("/api/v1/certificates/{$certificate->id}/print");

        $response->assertStatus(422);
        $this->assertDatabaseCount('certificate_print_log', 0);
    }
}
