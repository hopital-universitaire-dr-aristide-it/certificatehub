<?php

namespace Modules\Auth\Tests\Unit;

use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Modules\Auth\Services\AuthService;
use Tests\TestCase;

class AuthServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_attempt_login_returns_token_for_valid_credentials(): void
    {
        $user = User::factory()->create(['password' => bcrypt('secret123')]);

        $result = (new AuthService)->attemptLogin($user->email, 'secret123', 'test-device');

        $this->assertSame($user->id, $result['user']->id);
        $this->assertIsString($result['token']);
    }

    public function test_attempt_login_throws_for_wrong_password(): void
    {
        $user = User::factory()->create(['password' => bcrypt('secret123')]);

        $this->expectException(AuthenticationException::class);

        (new AuthService)->attemptLogin($user->email, 'wrong', null);
    }

    public function test_attempt_login_throws_for_inactive_user(): void
    {
        $user = User::factory()->create(['password' => bcrypt('secret123'), 'is_active' => false]);

        $this->expectException(AuthenticationException::class);

        (new AuthService)->attemptLogin($user->email, 'secret123', null);
    }

    public function test_logout_revokes_current_token(): void
    {
        $user = User::factory()->create();
        $user->createToken('test');
        /** @var PersonalAccessToken $accessToken */
        $accessToken = $user->tokens()->first();
        $user->withAccessToken($accessToken);

        (new AuthService)->logout($user);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
