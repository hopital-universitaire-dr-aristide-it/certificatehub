<?php

namespace Modules\Patient\Tests\Unit;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Patient\Models\Patient;
use Modules\Patient\Services\DeduplicationService;
use Tests\TestCase;

class DeduplicationServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_finds_patient_with_similar_name(): void
    {
        Patient::factory()->create(['first_name' => 'Jean', 'last_name' => 'Baptiste']);

        $matches = (new DeduplicationService)->findPotentialDuplicates('Jean', 'Baptist');

        $this->assertCount(1, $matches);
    }

    public function test_finds_accent_and_case_insensitive_match(): void
    {
        Patient::factory()->create(['first_name' => 'Djoovelyne', 'last_name' => 'Étienne']);

        $matches = (new DeduplicationService)->findPotentialDuplicates('djoovelyne', 'etienne');

        $this->assertCount(1, $matches);
    }

    public function test_does_not_match_unrelated_names(): void
    {
        Patient::factory()->create(['first_name' => 'Marie', 'last_name' => 'Joseph']);

        $matches = (new DeduplicationService)->findPotentialDuplicates('Robert', 'Casimir');

        $this->assertCount(0, $matches);
    }

    public function test_exact_date_of_birth_match_ranks_first(): void
    {
        Patient::factory()->create([
            'first_name' => 'Pierre', 'last_name' => 'Louis', 'date_of_birth' => '1990-05-01',
        ]);
        $sameDob = Patient::factory()->create([
            'first_name' => 'Pierre', 'last_name' => 'Louys', 'date_of_birth' => '1985-01-01',
        ]);

        $matches = (new DeduplicationService)->findPotentialDuplicates('Pierre', 'Louis', '1985-01-01');

        $this->assertSame($sameDob->id, $matches->first()->id);
    }
}
