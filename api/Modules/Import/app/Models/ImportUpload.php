<?php

namespace Modules\Import\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportUpload extends Model
{
    protected $fillable = [
        'tag',
        'original_filename',
        'raw_json',
        'uploaded_by',
        'completed_by',
        'completed_at',
        'import_batch_id',
    ];

    protected function casts(): array
    {
        return [
            'raw_json' => 'array',
            'completed_at' => 'datetime',
        ];
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function importBatch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class);
    }
}
