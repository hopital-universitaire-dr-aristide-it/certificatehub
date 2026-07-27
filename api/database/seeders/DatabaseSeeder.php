<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Certificate\Database\Seeders\CertificateDatabaseSeeder;
use Modules\FormHub\Database\Seeders\FormHubDatabaseSeeder;
use Modules\SystemAdmin\Database\Seeders\SystemAdminDatabaseSeeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            SystemAdminDatabaseSeeder::class,
            FormHubDatabaseSeeder::class,
            CertificateDatabaseSeeder::class,
        ]);
    }
}
