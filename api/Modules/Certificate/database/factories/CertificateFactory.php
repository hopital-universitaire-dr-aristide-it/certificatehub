<?php

namespace Modules\Certificate\Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Certificate\Enums\CertificateStatus;
use Modules\Certificate\Enums\PaymentStatus;
use Modules\Certificate\Models\Certificate;
use Modules\Certificate\Models\CertificateType;
use Modules\Patient\Models\Patient;

class CertificateFactory extends Factory
{
    protected $model = Certificate::class;

    public function definition(): array
    {
        return [
            'patient_id' => Patient::factory(),
            'certificate_type_id' => CertificateType::factory(),
            'created_by' => User::factory(),
            'doctor_id' => null,
            'fee_amount' => 500,
            'certificate_number' => null,
            'data' => null,
            'status' => CertificateStatus::Draft,
            'payment_status' => PaymentStatus::Unpaid,
            'finalized_at' => null,
        ];
    }
}
