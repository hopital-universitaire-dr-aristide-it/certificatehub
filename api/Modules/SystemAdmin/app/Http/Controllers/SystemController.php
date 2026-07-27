<?php

namespace Modules\SystemAdmin\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Redis;

class SystemController extends Controller
{
    /**
     * Etat des services dont depend l'application — reserve au role IT,
     * qui n'a acces a aucune donnee patient/certificat.
     */
    public function health()
    {
        $status = [
            'database' => $this->check(fn () => DB::select('select 1')),
            'redis' => $this->check(fn () => Redis::ping()),
        ];

        return response()->json($status);
    }

    /**
     * Dernieres lignes du log applicatif (pas de PHI attendu dans les logs Laravel).
     */
    public function logs()
    {
        $path = storage_path('logs/laravel.log');

        if (! File::exists($path)) {
            return response()->json(['lines' => []]);
        }

        $lines = collect(explode("\n", File::get($path)))->filter()->slice(-200)->values();

        return response()->json(['lines' => $lines]);
    }

    private function check(callable $probe): string
    {
        try {
            $probe();

            return 'ok';
        } catch (\Throwable) {
            return 'down';
        }
    }
}
