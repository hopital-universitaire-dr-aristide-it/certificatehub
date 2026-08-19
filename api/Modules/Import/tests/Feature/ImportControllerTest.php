<?php

namespace Modules\Import\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Modules\Certificate\Models\CertificateType;
use Modules\FormHub\Database\Seeders\CertificatSanteFormSeeder;
use Modules\FormHub\Models\FormDefinition;
use Modules\Import\Models\ImportBatch;
use Modules\Import\Models\ImportUpload;
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

    private function createUpload(User $uploader, ?array $entries = null): ImportUpload
    {
        return ImportUpload::create([
            'tag' => 'Lot Test',
            'original_filename' => 'certs.json',
            'raw_json' => $entries ?? $this->samplePayload(),
            'uploaded_by' => $uploader->id,
        ]);
    }

    private function confirmPayload(): array
    {
        return [
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
    }

    public function test_superadmin_can_upload_a_json_file(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $file = UploadedFile::fake()->createWithContent('certs.json', json_encode($this->samplePayload()));

        $response = $this->actingAs($superadmin, 'sanctum')->post('/api/v1/import/uploads', [
            'tag' => 'Lot Test',
            'file' => $file,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.tag', 'Lot Test')
            ->assertJsonPath('data.original_filename', 'certs.json');

        $this->assertDatabaseHas('import_uploads', ['tag' => 'Lot Test', 'uploaded_by' => $superadmin->id]);
    }

    public function test_upload_rejects_invalid_json(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $file = UploadedFile::fake()->createWithContent('bad.json', 'not json');

        $this->actingAs($superadmin, 'sanctum')->post('/api/v1/import/uploads', [
            'tag' => 'Lot Test',
            'file' => $file,
        ], ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_reception_cannot_upload_a_json_file(): void
    {
        $reception = $this->userWithRole('reception');
        $file = UploadedFile::fake()->createWithContent('certs.json', json_encode($this->samplePayload()));

        $this->actingAs($reception, 'sanctum')->post('/api/v1/import/uploads', [
            'tag' => 'Lot Test',
            'file' => $file,
        ])->assertStatus(403);
    }

    public function test_manager_ext_cannot_upload_a_json_file(): void
    {
        $managerExt = $this->userWithRole('manager_ext');
        $file = UploadedFile::fake()->createWithContent('certs.json', json_encode($this->samplePayload()));

        $this->actingAs($managerExt, 'sanctum')->post('/api/v1/import/uploads', [
            'tag' => 'Lot Test',
            'file' => $file,
        ])->assertStatus(403);
    }

    public function test_manager_ext_can_list_pending_uploads(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $this->createUpload($superadmin);
        $managerExt = $this->userWithRole('manager_ext');

        $response = $this->actingAs($managerExt, 'sanctum')->getJson('/api/v1/import/uploads');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Lot Test', $response->json('data.0.tag'));
    }

    public function test_completed_uploads_are_excluded_from_the_default_list(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $upload = $this->createUpload($superadmin);
        $upload->update(['completed_by' => $superadmin->id, 'completed_at' => now()]);
        $managerExt = $this->userWithRole('manager_ext');

        $response = $this->actingAs($managerExt, 'sanctum')->getJson('/api/v1/import/uploads');

        $this->assertCount(0, $response->json('data'));
    }

    public function test_reception_cannot_list_pending_uploads(): void
    {
        $reception = $this->userWithRole('reception');

        $this->actingAs($reception, 'sanctum')->getJson('/api/v1/import/uploads')->assertStatus(403);
    }

    public function test_manager_ext_can_parse_an_existing_upload(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $upload = $this->createUpload($superadmin);
        $managerExt = $this->userWithRole('manager_ext');

        $response = $this->actingAs($managerExt, 'sanctum')->getJson("/api/v1/import/uploads/{$upload->id}/parse");

        $response->assertOk();
        $this->assertCount(1, $response->json('patients'));
        $this->assertCount(1, $response->json('doctors'));
        $this->assertCount(1, $response->json('certificates'));
    }

    public function test_manager_ext_can_confirm_an_upload_and_records_land_in_the_database(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $upload = $this->createUpload($superadmin);
        $managerExt = $this->userWithRole('manager_ext');

        $response = $this->actingAs($managerExt, 'sanctum')
            ->postJson("/api/v1/import/uploads/{$upload->id}/confirm", $this->confirmPayload());

        $response->assertCreated()
            ->assertJsonPath('patients_created', 1)
            ->assertJsonPath('doctors_created', 1)
            ->assertJsonPath('certificates_created', 1)
            ->assertJsonPath('batch.tag', 'Lot Test');

        $this->assertDatabaseHas('patients', ['first_name' => 'Jean', 'last_name' => 'Pierre']);
        $this->assertDatabaseHas('users', ['email' => 'salomon@gmail.com']);
        $this->assertDatabaseHas('import_batches', ['tag' => 'Lot Test']);

        $batch = ImportBatch::where('tag', 'Lot Test')->firstOrFail();
        $this->assertDatabaseHas('import_uploads', [
            'id' => $upload->id,
            'completed_by' => $managerExt->id,
            'import_batch_id' => $batch->id,
        ]);
        $this->assertNotNull($upload->fresh()->completed_at);
    }

    public function test_superadmin_can_upload_then_immediately_continue_and_confirm(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $file = UploadedFile::fake()->createWithContent('certs.json', json_encode($this->samplePayload()));

        $uploadResponse = $this->actingAs($superadmin, 'sanctum')->post('/api/v1/import/uploads', [
            'tag' => 'Lot Test',
            'file' => $file,
        ]);
        $uploadId = $uploadResponse->json('data.id');

        $this->actingAs($superadmin, 'sanctum')
            ->getJson("/api/v1/import/uploads/{$uploadId}/parse")
            ->assertOk();

        $this->actingAs($superadmin, 'sanctum')
            ->postJson("/api/v1/import/uploads/{$uploadId}/confirm", $this->confirmPayload())
            ->assertCreated();

        $this->assertDatabaseHas('import_uploads', ['id' => $uploadId, 'completed_by' => $superadmin->id]);
    }

    public function test_reception_cannot_confirm_an_upload(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $upload = $this->createUpload($superadmin);
        $reception = $this->userWithRole('reception');

        $this->actingAs($reception, 'sanctum')
            ->postJson("/api/v1/import/uploads/{$upload->id}/confirm", $this->confirmPayload())
            ->assertStatus(403);
    }

    public function test_superadmin_can_delete_a_pending_upload(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $upload = $this->createUpload($superadmin);

        $this->actingAs($superadmin, 'sanctum')
            ->deleteJson("/api/v1/import/uploads/{$upload->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('import_uploads', ['id' => $upload->id]);
    }

    public function test_superadmin_cannot_delete_an_already_completed_upload(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $upload = $this->createUpload($superadmin);
        $upload->update(['completed_by' => $superadmin->id, 'completed_at' => now()]);

        $this->actingAs($superadmin, 'sanctum')
            ->deleteJson("/api/v1/import/uploads/{$upload->id}")
            ->assertStatus(422);

        $this->assertDatabaseHas('import_uploads', ['id' => $upload->id]);
    }

    public function test_manager_ext_cannot_delete_an_upload(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $upload = $this->createUpload($superadmin);
        $managerExt = $this->userWithRole('manager_ext');

        $this->actingAs($managerExt, 'sanctum')
            ->deleteJson("/api/v1/import/uploads/{$upload->id}")
            ->assertStatus(403);
    }

    public function test_reception_cannot_delete_an_upload(): void
    {
        $superadmin = $this->userWithRole('superadmin');
        $upload = $this->createUpload($superadmin);
        $reception = $this->userWithRole('reception');

        $this->actingAs($reception, 'sanctum')
            ->deleteJson("/api/v1/import/uploads/{$upload->id}")
            ->assertStatus(403);
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
