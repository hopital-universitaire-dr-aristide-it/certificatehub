<?php

namespace Modules\SystemAdmin\Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('SUPERADMIN_EMAIL', 'superadmin@certhub.local');
        $password = env('SUPERADMIN_PASSWORD', 'changeme');

        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => 'Super Admin',
                'password' => bcrypt($password),
                'is_active' => true,
            ]
        );

        if (! $user->hasRole('superadmin')) {
            $user->assignRole('superadmin');
        }
    }
}
