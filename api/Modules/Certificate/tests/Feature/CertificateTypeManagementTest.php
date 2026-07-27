<?php

namespace Modules\Certificate\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Certificate\Models\CertificateType;
use Modules\FormHub\Models\FormDefinition;
use Modules\SystemAdmin\Database\Seeders\RolesAndPermissionsSeeder;
use Tests\TestCase;

class CertificateTypeManagementTest extends TestCase
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

    public function test_reception_can_list_certificate_types(): void
    {
        CertificateType::factory()->create();
        $reception = $this->userWithRole('reception');

        $response = $this->actingAs($reception, 'sanctum')->getJson('/api/v1/certificate-types');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
    }

    public function test_reception_cannot_create_certificate_type(): void
    {
        $form = FormDefinition::factory()->create();
        $reception = $this->userWithRole('reception');

        $this->actingAs($reception, 'sanctum')->postJson('/api/v1/certificate-types', [
            'form_definition_id' => $form->id,
            'fee_amount' => 500,
        ])->assertStatus(403);
    }

    public function test_admin_can_create_certificate_type(): void
    {
        $form = FormDefinition::factory()->create();
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/certificate-types', [
            'form_definition_id' => $form->id,
            'fee_amount' => 750,
            'numbering_prefix' => 'XX',
            'numbering_next_value' => 100,
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('certificate_types', [
            'form_definition_id' => $form->id,
            'numbering_prefix' => 'XX',
            'numbering_next_value' => 100,
        ]);
    }

    public function test_admin_can_update_fee_and_numbering(): void
    {
        $type = CertificateType::factory()->create(['fee_amount' => 500, 'numbering_next_value' => 1]);
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/v1/certificate-types/{$type->id}", [
            'fee_amount' => 800,
            'numbering_next_value' => 250,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.fee_amount', 800)
            ->assertJsonPath('data.numbering_next_value', 250);
    }
}
