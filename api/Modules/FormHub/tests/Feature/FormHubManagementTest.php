<?php

namespace Modules\FormHub\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\FormHub\Enums\FieldType;
use Modules\FormHub\Models\FormDefinition;
use Modules\FormHub\Models\FormField;
use Modules\SystemAdmin\Database\Seeders\RolesAndPermissionsSeeder;
use Tests\TestCase;

class FormHubManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function makeFormWithField(): array
    {
        $form = FormDefinition::factory()->create();
        $field = FormField::create([
            'form_id' => $form->id,
            'field_key' => 'outcome',
            'default_label' => 'Resultat',
            'label' => 'Resultat',
            'field_type' => FieldType::Select,
            'sort_order' => 0,
        ]);

        return [$form, $field];
    }

    public function test_reception_can_list_active_form_definitions(): void
    {
        [$form] = $this->makeFormWithField();
        $reception = $this->userWithRole('reception');

        $response = $this->actingAs($reception, 'sanctum')->getJson('/api/v1/form-definitions');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
    }

    public function test_doctor_can_view_active_field_tree(): void
    {
        [$form] = $this->makeFormWithField();
        $doctor = $this->userWithRole('doctor');

        $response = $this->actingAs($doctor, 'sanctum')->getJson("/api/v1/form-definitions/{$form->id}/fields");

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('outcome', $response->json('data.0.field_key'));
    }

    public function test_active_field_tree_excludes_inactive_fields(): void
    {
        [$form, $field] = $this->makeFormWithField();
        $field->update(['is_active' => false]);
        $doctor = $this->userWithRole('doctor');

        $response = $this->actingAs($doctor, 'sanctum')->getJson("/api/v1/form-definitions/{$form->id}/fields");

        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }

    public function test_doctor_cannot_manage_fields(): void
    {
        [, $field] = $this->makeFormWithField();
        $doctor = $this->userWithRole('doctor');

        $this->actingAs($doctor, 'sanctum')
            ->patchJson("/api/v1/form-fields/{$field->id}/rename", ['label' => 'X'])
            ->assertStatus(403);
    }

    public function test_admin_can_rename_a_field(): void
    {
        [, $field] = $this->makeFormWithField();
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/form-fields/{$field->id}/rename", ['label' => 'Nouveau libelle']);

        $response->assertOk()->assertJsonPath('data.label', 'Nouveau libelle');
        $this->assertSame('outcome', $field->fresh()->field_key);
    }

    public function test_admin_can_reset_label(): void
    {
        [, $field] = $this->makeFormWithField();
        $field->update(['label' => 'Renomme']);
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/v1/form-fields/{$field->id}/reset-label");

        $response->assertOk()->assertJsonPath('data.label', 'Resultat');
    }

    public function test_admin_can_toggle_field_active(): void
    {
        [, $field] = $this->makeFormWithField();
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/form-fields/{$field->id}/active", ['is_active' => false]);

        $response->assertOk()->assertJsonPath('data.is_active', false);
    }

    public function test_admin_can_add_a_new_field(): void
    {
        [$form] = $this->makeFormWithField();
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/v1/form-definitions/{$form->id}/fields", [
            'field_key' => 'new_checkbox',
            'label' => 'Nouvelle case',
            'field_type' => 'boolean',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('form_fields', ['field_key' => 'new_checkbox', 'form_id' => $form->id]);
    }

    public function test_admin_can_reorder_fields(): void
    {
        [$form, $field1] = $this->makeFormWithField();
        $field2 = FormField::create([
            'form_id' => $form->id,
            'field_key' => 'second',
            'default_label' => 'Second',
            'label' => 'Second',
            'field_type' => FieldType::Text,
            'sort_order' => 1,
        ]);
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/form-fields/reorder', [
            'ordered_ids' => [$field2->id, $field1->id],
        ]);

        $response->assertOk();
        $this->assertSame(0, $field2->fresh()->sort_order);
        $this->assertSame(1, $field1->fresh()->sort_order);
    }

    public function test_admin_can_view_full_admin_field_tree_including_inactive(): void
    {
        [$form, $field] = $this->makeFormWithField();
        $field->update(['is_active' => false]);
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/v1/form-definitions/{$form->id}/admin-fields");

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
    }
}
