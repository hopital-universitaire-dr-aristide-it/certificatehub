<?php

namespace Modules\FormHub\Tests\Unit;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\FormHub\Enums\FieldType;
use Modules\FormHub\Models\FormDefinition;
use Modules\FormHub\Models\FormField;
use Modules\FormHub\Services\FormFieldService;
use Tests\TestCase;

class FormFieldServiceTest extends TestCase
{
    use RefreshDatabase;

    private function makeField(array $overrides = []): FormField
    {
        $form = FormDefinition::factory()->create();

        return FormField::create(array_merge([
            'form_id' => $form->id,
            'field_key' => 'test_field',
            'default_label' => 'Champ de test',
            'label' => 'Champ de test',
            'field_type' => FieldType::Text,
            'sort_order' => 0,
        ], $overrides));
    }

    public function test_rename_changes_label_only(): void
    {
        $field = $this->makeField();

        $renamed = (new FormFieldService)->rename($field, 'Nouveau libelle');

        $this->assertSame('Nouveau libelle', $renamed->label);
        $this->assertSame('test_field', $renamed->field_key);
        $this->assertSame('Champ de test', $renamed->default_label);
    }

    public function test_reset_label_restores_default(): void
    {
        $field = $this->makeField(['label' => 'Renomme']);

        $reset = (new FormFieldService)->resetLabel($field);

        $this->assertSame('Champ de test', $reset->label);
    }

    public function test_set_active_toggles_visibility_flag(): void
    {
        $field = $this->makeField();

        $deactivated = (new FormFieldService)->setActive($field, false);
        $this->assertFalse($deactivated->is_active);

        $reactivated = (new FormFieldService)->setActive($field, true);
        $this->assertTrue($reactivated->is_active);
    }

    public function test_reorder_updates_sort_order_by_position(): void
    {
        $form = FormDefinition::factory()->create();
        $a = FormField::create(['form_id' => $form->id, 'field_key' => 'a', 'default_label' => 'A', 'label' => 'A', 'field_type' => FieldType::Text, 'sort_order' => 0]);
        $b = FormField::create(['form_id' => $form->id, 'field_key' => 'b', 'default_label' => 'B', 'label' => 'B', 'field_type' => FieldType::Text, 'sort_order' => 1]);

        (new FormFieldService)->reorder([$b->id, $a->id]);

        $this->assertSame(0, $b->fresh()->sort_order);
        $this->assertSame(1, $a->fresh()->sort_order);
    }

    public function test_create_field_assigns_creator_and_defaults(): void
    {
        $form = FormDefinition::factory()->create();
        $user = User::factory()->create();

        $field = (new FormFieldService)->createField($form, [
            'field_key' => 'new_field',
            'label' => 'Nouveau champ',
            'field_type' => 'boolean',
        ], $user);

        $this->assertSame($user->id, $field->created_by);
        $this->assertSame('Nouveau champ', $field->default_label);
        $this->assertFalse($field->is_required);
    }
}
