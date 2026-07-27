<?php

namespace Modules\FormHub\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\FormHub\Enums\FieldType;

class FormField extends Model
{
    use HasUuids;

    protected $fillable = [
        'form_id',
        'parent_field_id',
        'field_key',
        'default_label',
        'label',
        'field_type',
        'is_required',
        'is_active',
        'sort_order',
        'config',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'field_type' => FieldType::class,
            'is_required' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
            'config' => 'array',
        ];
    }

    public function form(): BelongsTo
    {
        return $this->belongsTo(FormDefinition::class, 'form_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_field_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_field_id')->orderBy('sort_order');
    }

    public function activeChildren(): HasMany
    {
        return $this->children()->where('is_active', true);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
