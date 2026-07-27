<?php

namespace Modules\Certificate\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Certificate\Models\CertificateType;
use Modules\FormHub\Models\FormDefinition;

class CertificateTypeFactory extends Factory
{
    protected $model = CertificateType::class;

    public function definition(): array
    {
        return [
            'form_definition_id' => FormDefinition::factory(),
            'is_active' => true,
            'fee_amount' => 500,
            'numbering_prefix' => null,
            'numbering_next_value' => 1,
        ];
    }
}
