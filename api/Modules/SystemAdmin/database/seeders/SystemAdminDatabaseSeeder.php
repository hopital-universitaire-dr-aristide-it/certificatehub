<?php

namespace Modules\SystemAdmin\Database\Seeders;

use Illuminate\Database\Seeder;

class SystemAdminDatabaseSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            AdminUserSeeder::class,
            SettingsSeeder::class,
        ]);
    }
}
