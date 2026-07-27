<?php

namespace Modules\SystemAdmin\Tests\Unit;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\SystemAdmin\Database\Seeders\RolesAndPermissionsSeeder;
use Modules\SystemAdmin\Services\UserService;
use Tests\TestCase;

class UserServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_create_assigns_role_and_hashes_password(): void
    {
        $user = (new UserService)->create([
            'name' => 'Doc',
            'email' => 'doc@certhub.local',
            'password' => 'password123',
            'role' => 'doctor',
        ]);

        $this->assertTrue($user->hasRole('doctor'));
        $this->assertNotSame('password123', $user->password);
    }

    public function test_deactivate_revokes_tokens_and_flips_flag(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->createToken('t');

        $updated = (new UserService)->deactivate($user);

        $this->assertFalse($updated->is_active);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_reactivate_flips_flag_back(): void
    {
        $user = User::factory()->create(['is_active' => false]);

        $updated = (new UserService)->reactivate($user);

        $this->assertTrue($updated->is_active);
    }

    public function test_assign_role_replaces_previous_role(): void
    {
        $user = User::factory()->create();
        $user->assignRole('reception');

        $updated = (new UserService)->assignRole($user, 'doctor');

        $this->assertTrue($updated->hasRole('doctor'));
        $this->assertFalse($updated->hasRole('reception'));
    }

    public function test_update_only_touches_allowed_fields(): void
    {
        $user = User::factory()->create(['name' => 'Old Name']);

        $updated = (new UserService)->update($user, ['name' => 'New Name']);

        $this->assertSame('New Name', $updated->name);
    }
}
