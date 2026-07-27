<?php

namespace Modules\FormHub\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;
use Modules\FormHub\Database\Factories\FormDefinitionFactory;

class FormDefinition extends Model
{
    use HasFactory;

    protected $fillable = [
        'context_key',
        'module',
        'label',
        'description',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    protected static function newFactory(): FormDefinitionFactory
    {
        return FormDefinitionFactory::new();
    }

    public function fields(): HasMany
    {
        return $this->hasMany(FormField::class, 'form_id');
    }

    /**
     * Champs racine actifs, triés, avec leurs enfants (groupes) charges.
     */
    public function activeFieldTree(): Collection
    {
        return $this->fields()
            ->whereNull('parent_field_id')
            ->where('is_active', true)
            ->with(['activeChildren.activeChildren'])
            ->orderBy('sort_order')
            ->get();
    }
}
