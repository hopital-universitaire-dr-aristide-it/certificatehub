<?php

namespace Modules\Import\Tests\Unit;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Import\Services\ImportParseService;
use Modules\Patient\Models\Patient;
use Modules\SystemAdmin\Database\Seeders\RolesAndPermissionsSeeder;
use Tests\TestCase;

class ImportParseServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function entry(array $overrides = []): array
    {
        return array_replace_recursive([
            'source_file' => 'scan.png',
            'patient' => [
                'first_name' => 'Jean',
                'last_name' => 'Pierre',
                'sex' => null,
                'date_of_birth' => '2000-01-01',
                'age' => null,
                'residence' => 'Delmas',
            ],
            'certificate' => [
                'doctor_name' => 'Dr. Salomon',
                'exam_date' => '2026-08-01',
                'form_data' => [
                    'outcome' => 'sain',
                    'sign_contagieux' => false,
                    'sign_chronique' => false,
                    'sign_debilitant' => false,
                    'sign_trouble_mental' => false,
                    'recommandation' => null,
                ],
            ],
            'extraction_notes' => null,
        ], $overrides);
    }

    public function test_parse_returns_patient_doctor_and_certificate_rows(): void
    {
        $result = app(ImportParseService::class)->parse([$this->entry()]);

        $this->assertCount(1, $result['patients']);
        $this->assertCount(1, $result['doctors']);
        $this->assertCount(1, $result['certificates']);
        $this->assertSame('Jean', $result['patients'][0]['first_name']);
        $this->assertSame('c0', $result['certificates'][0]['row_id']);
        $this->assertSame($result['patients'][0]['row_id'], $result['certificates'][0]['patient_row_id']);
        $this->assertSame($result['doctors'][0]['row_id'], $result['certificates'][0]['doctor_row_id']);
    }

    public function test_parse_skips_entries_with_missing_patient_or_certificate(): void
    {
        $result = app(ImportParseService::class)->parse([
            $this->entry(),
            ['source_file' => 'blank.png', 'patient' => null, 'certificate' => null, 'extraction_notes' => 'scan vierge'],
        ]);

        $this->assertCount(1, $result['patients']);
        $this->assertCount(1, $result['skipped']);
        $this->assertSame('blank.png', $result['skipped'][0]['source_file']);
        $this->assertSame('scan vierge', $result['skipped'][0]['reason']);
    }

    public function test_parse_deduplicates_doctor_name_variants(): void
    {
        $result = app(ImportParseService::class)->parse([
            $this->entry(['certificate' => ['doctor_name' => 'Dr. Salomon']]),
            $this->entry(['patient' => ['first_name' => 'Marie'], 'certificate' => ['doctor_name' => 'Salomon']]),
            $this->entry(['patient' => ['first_name' => 'Ana'], 'certificate' => ['doctor_name' => 'Désir Harold']]),
        ]);

        $this->assertCount(2, $result['doctors']);
        $this->assertSame('salomon', $result['doctors'][0]['normalized_name']);
        $this->assertSame($result['doctors'][0]['row_id'], $result['certificates'][0]['doctor_row_id']);
        $this->assertSame($result['doctors'][0]['row_id'], $result['certificates'][1]['doctor_row_id']);
    }

    public function test_parse_pre_matches_an_existing_doctor_account_by_normalized_name(): void
    {
        $doctor = User::factory()->create(['name' => 'Salomon']);
        $doctor->assignRole('doctor');

        $result = app(ImportParseService::class)->parse([$this->entry(['certificate' => ['doctor_name' => 'Dr. Salomon']])]);

        $this->assertSame('existing', $result['doctors'][0]['action']);
        $this->assertSame($doctor->id, $result['doctors'][0]['matched_user_id']);
    }

    public function test_parse_flags_an_exact_duplicate_patient(): void
    {
        $existing = Patient::factory()->create([
            'first_name' => 'Jean',
            'last_name' => 'Pierre',
            'sex' => null,
            'date_of_birth' => '2000-01-01',
        ]);

        $result = app(ImportParseService::class)->parse([$this->entry()]);

        $this->assertSame($existing->id, $result['patients'][0]['exact_duplicate_patient_id']);
    }

    public function test_parse_is_replayable_without_side_effects(): void
    {
        $entries = [$this->entry()];

        $first = app(ImportParseService::class)->parse($entries);
        $second = app(ImportParseService::class)->parse($entries);

        $this->assertSame($first, $second);
    }
}
