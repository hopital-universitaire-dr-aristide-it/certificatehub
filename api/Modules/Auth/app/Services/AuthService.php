<?php

namespace Modules\Auth\Services;

use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\Hash;

class AuthService
{
    /**
     * @throws AuthenticationException
     */
    public function attemptLogin(string $email, string $password, ?string $deviceName): array
    {
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            throw new AuthenticationException('Identifiants invalides.');
        }

        if (! $user->is_active) {
            throw new AuthenticationException('Ce compte a été désactivé.');
        }

        $token = $user->createToken($deviceName ?: 'api')->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    public function logout(User $user): void
    {
        $token = $user->currentAccessToken();

        if ($token) {
            $token->delete();
        }
    }
}
