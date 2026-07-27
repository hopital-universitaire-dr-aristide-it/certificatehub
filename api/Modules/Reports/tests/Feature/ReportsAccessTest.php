<?php

namespace Modules\Reports\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\SystemAdmin\Database\Seeders\RolesAndPermissionsSeeder;
use Tests\TestCase;

class ReportsAccessTest extends TestCase
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

    public function test_admin_can_view_certificate_report(): void
    {
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/reports/certificates?period=month');

        $response->assertOk()->assertJsonStructure([
            'period', 'volume', 'turnaround', 'revenue', 'clinical', 'cached_at',
        ]);
    }

    public function test_doctor_cannot_view_certificate_report(): void
    {
        $doctor = $this->userWithRole('doctor');

        $this->actingAs($doctor, 'sanctum')->getJson('/api/v1/reports/certificates')->assertStatus(403);
    }

    public function test_reception_cannot_view_certificate_report(): void
    {
        $reception = $this->userWithRole('reception');

        $this->actingAs($reception, 'sanctum')->getJson('/api/v1/reports/certificates')->assertStatus(403);
    }

    public function test_superadmin_can_view_certificate_report(): void
    {
        $superadmin = $this->userWithRole('superadmin');

        $this->actingAs($superadmin, 'sanctum')->getJson('/api/v1/reports/certificates')->assertOk();
    }
}
