<?php

namespace Modules\Import\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Modules\Certificate\Models\CertificateType;
use Modules\FormHub\Database\Seeders\CertificatSanteFormSeeder;
use Modules\FormHub\Models\FormDefinition;
use Modules\Import\Models\ImportBatch;
use Modules\SystemAdmin\Database\Seeders\RolesAndPermissionsSeeder;
use Tests\TestCase;

class ImportControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(CertificatSanteFormSeeder::class);

        $form = FormDefinition::where('context_key', 'certificate.sante')->firstOrFail();
        CertificateType::factory()->create(['form_definition_id' => $form->id]);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function samplePayload(): array
    {
        return [
            [
                'source_file' => 'a.png',
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
            ],
        ];
    }

    public function test_superadmin_can_parse_a_json_file(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $file = UploadedFile::fake()->createWithContent('certs.json', json_encode($this->samplePayload()));

        $response = $this->actingAs($superadmin, 'sanctum')->post('/api/v1/import/parse', [
            'tag' => 'Lot Test',
            'file' => $file,
        ]);

        $response->assertOk();
        $this->assertCount(1, $response->json('patients'));
        $this->assertCount(1, $response->json('doctors'));
        $this->assertCount(1, $response->json('certificates'));
    }

    public function test_reception_cannot_parse_a_json_file(): void
    {
        $reception = $this->userWithRole('reception');
        $file = UploadedFile::fake()->createWithContent('certs.json', json_encode($this->samplePayload()));

        $this->actingAs($reception, 'sanctum')->post('/api/v1/import/parse', [
            'tag' => 'Lot Test',
            'file' => $file,
        ])->assertStatus(403);
    }

    public function test_superadmin_can_confirm_an_import_and_records_land_in_the_database(): void
    {
        $superadmin = $this->userWithRole('superadmin');

        $payload = [
            'tag' => 'Lot Test',
            'doctors' => [
                ['row_id' => 'd0', 'name' => 'Dr. Salomon', 'action' => 'create', 'matched_user_id' => null],
            ],
            'patients' => [
                [
                    'row_id' => 'p0',
                    'first_name' => 'Jean',
                    'last_name' => 'Pierre',
                    'sex' => null,
                    'date_of_birth' => '2000-01-01',
                    'age' => null,
                    'residence' => 'Delmas',
                ],
            ],
            'certificates' => [
                [
                    'row_id' => 'c0',
                    'patient_row_id' => 'p0',
                    'doctor_row_id' => 'd0',
                    'exam_date' => '2026-08-01',
                    'form_data' => [
                        'outcome' => 'sain',
                        'sign_contagieux' => false,
                        'sign_chronique' => false,
                        'sign_debilitant' => false,
                        'sign_trouble_mental' => false,
                    ],
                ],
            ],
        ];

        $response = $this->actingAs($superadmin, 'sanctum')->postJson('/api/v1/import/confirm', $payload);

        $response->assertCreated()
            ->assertJsonPath('patients_created', 1)
            ->assertJsonPath('doctors_created', 1)
            ->assertJsonPath('certificates_created', 1)
            ->assertJsonPath('batch.tag', 'Lot Test');

        $this->assertDatabaseHas('patients', ['first_name' => 'Jean', 'last_name' => 'Pierre']);
        $this->assertDatabaseHas('users', ['email' => 'salomon@gmail.com']);
        $this->assertDatabaseHas('import_batches', ['tag' => 'Lot Test']);
    }

    public function test_reception_cannot_confirm_an_import(): void
    {
        $reception = $this->userWithRole('reception');

        $this->actingAs($reception, 'sanctum')->postJson('/api/v1/import/confirm', [
            'tag' => 'Lot Test',
            'doctors' => [],
            'patients' => [],
            'certificates' => [],
        ])->assertStatus(403);
    }

    public function test_reception_can_list_import_batches_for_the_filter(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        ImportBatch::create(['tag' => 'Lot Test', 'created_by' => $superadmin->id]);
        $reception = $this->userWithRole('reception');

        $response = $this->actingAs($reception, 'sanctum')->getJson('/api/v1/import-batches');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Lot Test', $response->json('data.0.tag'));
    }

    public function test_doctor_cannot_list_import_batches(): void
    {
        $doctor = $this->userWithRole('doctor');

        $this->actingAs($doctor, 'sanctum')->getJson('/api/v1/import-batches')->assertStatus(403);
    }
}
