<?php

namespace Modules\Import\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Certificate\Models\Certificate;
use Modules\Patient\Models\Patient;

class ImportBatch extends Model
{
    protected $fillable = [
        'tag',
        'created_by',
    ];

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function patients(): HasMany
    {
        return $this->hasMany(Patient::class);
    }

    public function certificates(): HasMany
    {
        return $this->hasMany(Certificate::class);
    }

    public function doctors(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
