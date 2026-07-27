<?php

namespace Modules\SystemAdmin\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\SystemAdmin\Database\Seeders\RolesAndPermissionsSeeder;
use Tests\TestCase;

class UserManagementTest extends TestCase
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

    public function test_admin_can_list_users(): void
    {
        $admin = $this->userWithRole('admin');
        User::factory()->count(3)->create();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/users');

        $response->assertOk();
        $this->assertCount(4, $response->json('data'));
    }

    public function test_doctor_cannot_list_users(): void
    {
        $doctor = $this->userWithRole('doctor');

        $this->actingAs($doctor, 'sanctum')->getJson('/api/v1/users')->assertStatus(403);
    }

    public function test_admin_can_create_user_with_role(): void
    {
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/users', [
            'name' => 'Dr. Jean Baptiste',
            'email' => 'jbaptiste@certhub.local',
            'password' => 'password123',
            'role' => 'doctor',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('users', ['email' => 'jbaptiste@certhub.local']);
        $created = User::where('email', 'jbaptiste@certhub.local')->first();
        $this->assertTrue($created->hasRole('doctor'));
    }

    public function test_create_user_rejects_unknown_role(): void
    {
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/users', [
            'name' => 'Someone',
            'email' => 'someone@certhub.local',
            'password' => 'password123',
            'role' => 'not-a-real-role',
        ]);

        $response->assertStatus(422);
    }

    public function test_admin_can_deactivate_and_reactivate_user(): void
    {
        $admin = $this->userWithRole('admin');
        $target = $this->userWithRole('reception');
        $token = $target->createToken('t')->plainTextToken;

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/users/{$target->id}/deactivate")
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseCount('personal_access_tokens', 0);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/users/{$target->id}/reactivate")
            ->assertOk()
            ->assertJsonPath('data.is_active', true);
    }

    public function test_admin_can_change_user_role(): void
    {
        $admin = $this->userWithRole('admin');
        $target = $this->userWithRole('reception');

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/users/{$target->id}/role", ['role' => 'doctor']);

        $response->assertOk();
        $this->assertTrue($target->fresh()->hasRole('doctor'));
        $this->assertFalse($target->fresh()->hasRole('reception'));
    }

    public function test_superadmin_has_all_permissions(): void
    {
        $superadmin = $this->userWithRole('superadmin');

        $this->actingAs($superadmin, 'sanctum')->getJson('/api/v1/users')->assertOk();
        $this->actingAs($superadmin, 'sanctum')->getJson('/api/v1/system/health')->assertOk();
    }

    public function test_it_role_cannot_access_users(): void
    {
        $it = $this->userWithRole('it');

        $this->actingAs($it, 'sanctum')->getJson('/api/v1/users')->assertStatus(403);
    }

    public function test_it_role_can_view_system_health(): void
    {
        $it = $this->userWithRole('it');

        $this->actingAs($it, 'sanctum')->getJson('/api/v1/system/health')
            ->assertOk()
            ->assertJsonStructure(['database', 'redis']);
    }

    public function test_it_role_can_view_system_logs(): void
    {
        $it = $this->userWithRole('it');

        $this->actingAs($it, 'sanctum')->getJson('/api/v1/system/logs')
            ->assertOk()
            ->assertJsonStructure(['lines']);
    }

    public function test_admin_can_update_user_details(): void
    {
        $admin = $this->userWithRole('admin');
        $target = $this->userWithRole('reception');

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/users/{$target->id}", ['name' => 'Nom Modifie']);

        $response->assertOk()->assertJsonPath('data.name', 'Nom Modifie');
        $this->assertSame('Nom Modifie', $target->fresh()->name);
    }

    public function test_update_rejects_duplicate_email(): void
    {
        $admin = $this->userWithRole('admin');
        $target = $this->userWithRole('reception');
        $other = $this->userWithRole('doctor');

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/users/{$target->id}", ['email' => $other->email]);

        $response->assertStatus(422);
    }
}
