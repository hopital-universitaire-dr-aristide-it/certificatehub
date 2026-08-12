<?php

namespace Modules\Patient\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Scout\Searchable;
use Modules\Import\Models\ImportBatch;
use Modules\Patient\Database\Factories\PatientFactory;

class Patient extends Model
{
    use HasFactory, Searchable, SoftDeletes;

    protected $fillable = [
        'first_name',
        'last_name',
        'sex',
        'date_of_birth',
        'age',
        'residence',
        'created_by',
        'import_batch_id',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
        ];
    }

    protected static function newFactory(): PatientFactory
    {
        return PatientFactory::new();
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function importBatch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class);
    }

    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    /**
     * Calculee a partir de date_of_birth (age exact, recalcule a chaque lecture
     * par rapport a aujourd'hui) quand elle est connue. Sinon, on retombe sur
     * la colonne 'age' saisie a la main — utile pour les patients qui ne
     * connaissent pas leur date de naissance exacte.
     */
    protected function age(): Attribute
    {
        return Attribute::make(
            get: fn (?int $value) => $this->date_of_birth?->age ?? $value,
        );
    }

    /**
     * Pronom à utiliser dans les documents générés. Retombe sur "il / elle"
     * quand le sexe n'a pas été renseigné, pour rester correct par défaut.
     */
    public function getPronounAttribute(): string
    {
        return match ($this->sex) {
            'M' => 'il',
            'F' => 'elle',
            default => 'il / elle',
        };
    }

    public function toSearchableArray(): array
    {
        return [
            'id' => (string) $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'residence' => (string) $this->residence,
            'date_of_birth' => $this->date_of_birth?->timestamp,
            'created_at' => $this->created_at?->timestamp,
        ];
    }
}
