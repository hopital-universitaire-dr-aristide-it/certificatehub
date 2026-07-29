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

    /**
     * Regression : CertificateResource omettait la colonne JSONB "data" —
     * le medecin sauvegardait bien cote backend, mais le frontend (qui lit
     * ce champ pour savoir si l'apercu doit se debloquer et pour reafficher
     * les valeurs) ne voyait jamais le changement puisque GET
     * /certificates/{id} ne le renvoyait jamais. Expose sous le nom
     * "form_data" (pas "data") pour ne pas entrer en collision avec la cle
     * d'enveloppe par defaut de JsonResource — voir le commentaire dans
     * CertificateResource.
     */
    public function test_show_returns_the_saved_form_data(): void
    {
        $type = $this->santeType();
        $certificate = Certificate::factory()->create([
            'certificate_type_id' => $type->id,
            'payment_status' => PaymentStatus::Paid,
        ]);
        $doctor = $this->userWithRole('doctor');

        $this->actingAs($doctor, 'sanctum')->putJson("/api/v1/certificates/{$certificate->id}", [
            'data' => ['outcome' => 'presente_signes', 'sign_contagieux' => true],
        ])->assertOk();

        $show = $this->actingAs($doctor, 'sanctum')->getJson("/api/v1/certificates/{$certificate->id}");

        $show->assertOk()
            ->assertJsonPath('data.form_data.outcome', 'presente_signes')
            ->assertJsonPath('data.form_data.sign_contagieux', true);
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

    public function test_doctor_can_list_only_their_own_certificates(): void
    {
        $type = $this->santeType();
        $doctorA = $this->userWithRole('doctor');
        $doctorB = $this->userWithRole('doctor');
        $mine = Certificate::factory()->create(['certificate_type_id' => $type->id, 'doctor_id' => $doctorA->id]);
        Certificate::factory()->create(['certificate_type_id' => $type->id, 'doctor_id' => $doctorB->id]);

        $response = $this->actingAs($doctorA, 'sanctum')->getJson('/api/v1/certificates/mine');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame($mine->id, $response->json('data.0.id'));
    }

    public function test_reception_cannot_access_mine_endpoint(): void
    {
        $reception = $this->userWithRole('reception');

        $this->actingAs($reception, 'sanctum')->getJson('/api/v1/certificates/mine')->assertStatus(403);
    }

    /**
     * @dataProvider oversightRoles
     */
    public function test_oversight_roles_can_cancel_and_restore_a_certificate(string $role): void
    {
        $certificate = Certificate::factory()->create(['payment_status' => PaymentStatus::Paid]);
        $user = $this->userWithRole($role);

        $this->actingAs($user, 'sanctum')->deleteJson("/api/v1/certificates/{$certificate->id}")->assertNoContent();
        $this->assertSoftDeleted('certificates', ['id' => $certificate->id]);

        // Le paiement n'est jamais touche par l'annulation du certificat — les
        // deux actions sont volontairement independantes.
        $this->assertDatabaseHas('certificates', ['id' => $certificate->id, 'payment_status' => 'paid']);

        $restore = $this->actingAs($user, 'sanctum')->postJson("/api/v1/certificates/{$certificate->id}/restore");
        $restore->assertOk()->assertJsonPath('data.id', $certificate->id);
        $this->assertDatabaseHas('certificates', ['id' => $certificate->id, 'deleted_at' => null]);
    }

    public static function oversightRoles(): array
    {
        return [['admin'], ['it'], ['superadmin']];
    }

    public function test_reception_and_doctor_cannot_cancel_a_certificate(): void
    {
        $certificate = Certificate::factory()->create();

        $this->actingAs($this->userWithRole('reception'), 'sanctum')
            ->deleteJson("/api/v1/certificates/{$certificate->id}")->assertStatus(403);
        $this->actingAs($this->userWithRole('doctor'), 'sanctum')
            ->deleteJson("/api/v1/certificates/{$certificate->id}")->assertStatus(403);
    }

    public function test_trashed_certificates_are_listed_for_oversight_roles(): void
    {
        $certificate = Certificate::factory()->create();
        $certificate->delete();
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/certificates/trashed');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame($certificate->id, $response->json('data.0.id'));
    }
}
