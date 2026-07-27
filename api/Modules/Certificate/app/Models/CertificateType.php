<?php

namespace Modules\Certificate\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Certificate\Database\Factories\CertificateTypeFactory;
use Modules\FormHub\Models\FormDefinition;

class CertificateType extends Model
{
    use HasFactory;

    protected $fillable = [
        'form_definition_id',
        'is_active',
        'fee_amount',
        'numbering_prefix',
        'numbering_next_value',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'fee_amount' => 'decimal:2',
        ];
    }

    protected static function newFactory(): CertificateTypeFactory
    {
        return CertificateTypeFactory::new();
    }

    public function formDefinition(): BelongsTo
    {
        return $this->belongsTo(FormDefinition::class);
    }

    public function certificates(): HasMany
    {
        return $this->hasMany(Certificate::class);
    }

    /**
     * Réserve le prochain numéro et incrémente le compteur. À appeler dans
     * une transaction avec verrouillage (lockForUpdate) pour éviter les
     * doublons de numéro sous concurrence — voir CertificateService::finalize().
     */
    public function reserveNextNumber(): string
    {
        $number = $this->numbering_next_value;
        $this->increment('numbering_next_value');

        $prefix = $this->numbering_prefix ? "{$this->numbering_prefix}-" : '';

        return sprintf('%s%06d', $prefix, $number);
    }
}
