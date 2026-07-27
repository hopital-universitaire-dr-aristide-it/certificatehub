<?php

namespace Modules\SystemAdmin\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\SystemAdmin\Models\Setting;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        Setting::firstOrCreate(
            ['key' => 'directeur_medical_name'],
            ['value' => 'Dr. Joseph Edmond Pierre']
        );
    }
}
