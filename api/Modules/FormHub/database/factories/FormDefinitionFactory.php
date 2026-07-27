<?php

namespace Modules\FormHub\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\FormHub\Models\FormDefinition;

class FormDefinitionFactory extends Factory
{
    protected $model = FormDefinition::class;

    public function definition(): array
    {
        return [
            'context_key' => 'test.'.$this->faker->unique()->slug(2),
            'module' => 'Test',
            'label' => $this->faker->sentence(3),
            'description' => $this->faker->sentence(),
            'is_active' => true,
        ];
    }
}
