<?php

namespace Modules\SystemAdmin\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['key', 'value'];

    private const CACHE_TTL = 86400;

    public static function get(string $key, ?string $default = null): ?string
    {
        return Cache::remember("setting:{$key}", self::CACHE_TTL, function () use ($key, $default) {
            return static::find($key)?->value ?? $default;
        });
    }

    public static function set(string $key, ?string $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget("setting:{$key}");
    }
}
