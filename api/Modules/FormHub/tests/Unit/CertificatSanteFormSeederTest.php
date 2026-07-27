<?php

namespace Modules\FormHub\Tests\Unit;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\FormHub\Database\Seeders\CertificatSanteFormSeeder;
use Modules\FormHub\Models\FormDefinition;
use Tests\TestCase;

class CertificatSanteFormSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeds_merged_certificate_form_with_expected_fields(): void
    {
        $this->seed(CertificatSanteFormSeeder::class);

        $form = FormDefinition::where('context_key', 'certificate.sante')->firstOrFail();

        $keys = $form->fields()->orderBy('sort_order')->pluck('field_key')->all();

        $this->assertSame([
            'outcome',
            'sign_contagieux',
            'sign_chronique',
            'sign_debilitant',
            'sign_trouble_mental',
            'recommandation',
        ], $keys);
    }

    public function test_seeder_is_idempotent(): void
    {
        $this->seed(CertificatSanteFormSeeder::class);
        $this->seed(CertificatSanteFormSeeder::class);

        $this->assertSame(1, FormDefinition::where('context_key', 'certificate.sante')->count());
        $this->assertSame(6, FormDefinition::where('context_key', 'certificate.sante')->first()->fields()->count());
    }
}
