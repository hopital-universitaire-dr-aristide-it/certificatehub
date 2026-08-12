<?php

namespace Modules\Certificate\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Certificate\Database\Factories\CertificateFactory;
use Modules\Certificate\Enums\CertificateStatus;
use Modules\Certificate\Enums\PaymentStatus;
use Modules\Import\Models\ImportBatch;
use Modules\Patient\Models\Patient;

class Certificate extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'patient_id',
        'certificate_type_id',
        'created_by',
        'doctor_id',
        'fee_amount',
        'certificate_number',
        'data',
        'status',
        'payment_status',
        'paid_at',
        'finalized_at',
        'manually_printed_at',
        'import_batch_id',
    ];

    protected function casts(): array
    {
        return [
            'fee_amount' => 'decimal:2',
            'data' => 'array',
            'status' => CertificateStatus::class,
            'payment_status' => PaymentStatus::class,
            'paid_at' => 'datetime',
            'finalized_at' => 'datetime',
            'manually_printed_at' => 'datetime',
        ];
    }

    protected static function newFactory(): CertificateFactory
    {
        return CertificateFactory::new();
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function certificateType(): BelongsTo
    {
        return $this->belongsTo(CertificateType::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }

    public function importBatch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class);
    }
}
