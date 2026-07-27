<?php

namespace Modules\Patient\Tests\Unit;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Patient\Models\Patient;
use Tests\TestCase;

class PatientModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_full_name_attribute_concatenates_names(): void
    {
        $patient = Patient::factory()->make(['first_name' => 'Jean', 'last_name' => 'Baptiste']);

        $this->assertSame('Jean Baptiste', $patient->full_name);
    }

    public function test_searchable_array_contains_expected_keys(): void
    {
        $patient = Patient::factory()->create([
            'first_name' => 'Jean',
            'last_name' => 'Baptiste',
            'residence' => 'Tabarre',
            'date_of_birth' => '1990-01-01',
        ]);

        $array = $patient->toSearchableArray();

        $this->assertSame((string) $patient->id, $array['id']);
        $this->assertSame('Jean Baptiste', $array['full_name']);
        $this->assertSame('Tabarre', $array['residence']);
        $this->assertIsInt($array['date_of_birth']);
        $this->assertIsInt($array['created_at']);
    }

    public function test_pronoun_matches_sex(): void
    {
        $this->assertSame('il', Patient::factory()->make(['sex' => 'M'])->pronoun);
        $this->assertSame('elle', Patient::factory()->make(['sex' => 'F'])->pronoun);
    }

    public function test_pronoun_falls_back_when_sex_unknown(): void
    {
        $this->assertSame('il / elle', Patient::factory()->make(['sex' => null])->pronoun);
    }
}
