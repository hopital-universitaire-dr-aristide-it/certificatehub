<?php

namespace Modules\Patient\Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Patient\Models\Patient;

class PatientFactory extends Factory
{
    protected $model = Patient::class;

    public function definition(): array
    {
        return [
            'first_name' => $this->faker->firstName(),
            'last_name' => $this->faker->lastName(),
            'sex' => $this->faker->randomElement(['M', 'F']),
            'date_of_birth' => $this->faker->dateTimeBetween('-90 years', '-1 years'),
            'age' => null,
            'residence' => $this->faker->city(),
            'created_by' => User::factory(),
        ];
    }
}
