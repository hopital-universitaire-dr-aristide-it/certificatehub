<?php

namespace Modules\FormHub\Database\Seeders;

use Illuminate\Database\Seeder;

class FormHubDatabaseSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->call([
            CertificatSanteFormSeeder::class,
        ]);
    }
}
