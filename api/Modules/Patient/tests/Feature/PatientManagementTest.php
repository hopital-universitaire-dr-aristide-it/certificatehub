<?php

namespace Modules\Patient\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Patient\Models\Patient;
use Modules\SystemAdmin\Database\Seeders\RolesAndPermissionsSeeder;
use Tests\TestCase;

class PatientManagementTest extends TestCase
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

    public function test_reception_can_create_a_patient(): void
    {
        $reception = $this->userWithRole('reception');

        $response = $this->actingAs($reception, 'sanctum')->postJson('/api/v1/patients', [
            'first_name' => 'Marie',
            'last_name' => 'Joseph',
            'date_of_birth' => '1995-03-12',
            'residence' => 'Tabarre',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('patients', ['first_name' => 'Marie', 'last_name' => 'Joseph', 'created_by' => $reception->id]);
        $this->assertSame([], $response->json('potential_duplicates'));
    }

    public function test_create_surfaces_potential_duplicates(): void
    {
        $reception = $this->userWithRole('reception');
        Patient::factory()->create(['first_name' => 'Marie', 'last_name' => 'Joseph']);

        $response = $this->actingAs($reception, 'sanctum')->postJson('/api/v1/patients', [
            'first_name' => 'Marie',
            'last_name' => 'Josef',
        ]);

        $response->assertCreated();
        $this->assertNotEmpty($response->json('potential_duplicates'));
    }

    public function test_doctor_cannot_create_a_patient(): void
    {
        $doctor = $this->userWithRole('doctor');

        $this->actingAs($doctor, 'sanctum')->postJson('/api/v1/patients', [
            'first_name' => 'Marie',
            'last_name' => 'Joseph',
        ])->assertStatus(403);
    }

    public function test_doctor_can_view_a_patient(): void
    {
        $doctor = $this->userWithRole('doctor');
        $patient = Patient::factory()->create();

        $this->actingAs($doctor, 'sanctum')->getJson("/api/v1/patients/{$patient->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $patient->id);
    }

    public function test_it_role_cannot_view_patients(): void
    {
        $it = $this->userWithRole('it');
        $patient = Patient::factory()->create();

        $this->actingAs($it, 'sanctum')->getJson("/api/v1/patients/{$patient->id}")->assertStatus(403);
    }

    public function test_reception_can_update_patient(): void
    {
        $reception = $this->userWithRole('reception');
        $patient = Patient::factory()->create(['residence' => 'Delmas']);

        $response = $this->actingAs($reception, 'sanctum')
            ->putJson("/api/v1/patients/{$patient->id}", ['residence' => 'Petion-Ville']);

        $response->assertOk()->assertJsonPath('data.residence', 'Petion-Ville');
    }

    public function test_doctor_cannot_update_patient(): void
    {
        $doctor = $this->userWithRole('doctor');
        $patient = Patient::factory()->create();

        $this->actingAs($doctor, 'sanctum')
            ->putJson("/api/v1/patients/{$patient->id}", ['residence' => 'Petion-Ville'])
            ->assertStatus(403);
    }

    public function test_search_requires_at_least_two_characters(): void
    {
        $doctor = $this->userWithRole('doctor');

        $response = $this->actingAs($doctor, 'sanctum')->getJson('/api/v1/patients/search?q=a');

        $response->assertOk();
        $this->assertSame([], $response->json('data'));
    }

    public function test_search_endpoint_is_permission_gated(): void
    {
        $it = $this->userWithRole('it');

        $this->actingAs($it, 'sanctum')->getJson('/api/v1/patients/search?q=marie')->assertStatus(403);
    }

    public function test_reception_can_list_patients(): void
    {
        $reception = $this->userWithRole('reception');
        Patient::factory()->count(2)->create();

        $response = $this->actingAs($reception, 'sanctum')->getJson('/api/v1/patients');

        $response->assertOk();
        $this->assertCount(2, $response->json('data'));
    }
}
