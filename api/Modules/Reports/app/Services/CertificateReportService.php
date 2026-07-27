<?php

namespace Modules\Reports\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class CertificateReportService
{
    private const CACHE_TTL = 3600;

    public function summary(array $filters): array
    {
        $cacheKey = 'report:certificates:'.$this->periodHash($filters);

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($filters) {
            [$from, $to] = $this->resolvePeriod($filters);

            return [
                'period' => ['from' => $from, 'to' => $to],
                'volume' => $this->volume($from, $to),
                'turnaround' => $this->turnaround($from, $to),
                'revenue' => $this->revenue($from, $to),
                'clinical' => $this->clinical($from, $to),
                'cached_at' => now()->toIso8601String(),
            ];
        });
    }

    /**
     * Vide tout le cache applicatif (pas seulement les clés report:*) — un
     * ciblage par pattern (Cache::getRedis()->keys()) suppose un driver Redis
     * et casse sous le driver "array" utilisé en tests. Le volume de requêtes
     * de cette appli reste assez faible pour que ce soit un compromis correct.
     */
    public function flushCache(): void
    {
        Cache::flush();
    }

    private function volume(string $from, string $to): array
    {
        $total = DB::table('certificates')->whereBetween('created_at', [$from, $to])->count();

        $byDay = DB::table('certificates')
            ->selectRaw('DATE(created_at) as day, COUNT(*) as count')
            ->whereBetween('created_at', [$from, $to])
            ->groupBy('day')
            ->orderBy('day')
            ->get();

        $byDoctor = DB::table('certificates')
            ->join('users', 'users.id', '=', 'certificates.doctor_id')
            ->selectRaw('users.name as doctor_name, COUNT(*) as count')
            ->whereBetween('certificates.created_at', [$from, $to])
            ->groupBy('users.name')
            ->orderByDesc('count')
            ->get();

        $byCertificateType = DB::table('certificates')
            ->join('certificate_types', 'certificate_types.id', '=', 'certificates.certificate_type_id')
            ->join('form_definitions', 'form_definitions.id', '=', 'certificate_types.form_definition_id')
            ->selectRaw('form_definitions.label as type_label, COUNT(*) as count')
            ->whereBetween('certificates.created_at', [$from, $to])
            ->groupBy('form_definitions.label')
            ->orderByDesc('count')
            ->get();

        return [
            'total' => $total,
            'by_day' => $byDay,
            'by_doctor' => $byDoctor,
            'by_certificate_type' => $byCertificateType,
        ];
    }

    private function turnaround(string $from, string $to): array
    {
        $row = DB::table('certificates')
            ->whereNotNull('finalized_at')
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('AVG(EXTRACT(EPOCH FROM (finalized_at - created_at)) / 3600) as avg_hours')
            ->first();

        return [
            'avg_hours' => $row?->avg_hours !== null ? round((float) $row->avg_hours, 2) : null,
        ];
    }

    private function revenue(string $from, string $to): array
    {
        $totalPaid = (float) DB::table('certificates')
            ->where('payment_status', 'paid')
            ->whereBetween('created_at', [$from, $to])
            ->sum('fee_amount');

        $unpaidCount = DB::table('certificates')
            ->where('payment_status', 'unpaid')
            ->whereBetween('created_at', [$from, $to])
            ->count();

        $byDay = DB::table('certificates')
            ->where('payment_status', 'paid')
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('DATE(created_at) as day, SUM(fee_amount) as total')
            ->groupBy('day')
            ->orderBy('day')
            ->get();

        return [
            'total_paid' => $totalPaid,
            'unpaid_count' => $unpaidCount,
            'by_day' => $byDay,
        ];
    }

    private function clinical(string $from, string $to): array
    {
        $rows = DB::table('certificates')
            ->whereNotNull('data')
            ->whereBetween('created_at', [$from, $to])
            ->pluck('data');

        $sain = 0;
        $presenteSignes = 0;
        $signCounts = [];

        foreach ($rows as $raw) {
            $data = json_decode($raw, true) ?? [];

            if (($data['outcome'] ?? null) === 'presente_signes') {
                $presenteSignes++;
            } elseif (($data['outcome'] ?? null) === 'sain') {
                $sain++;
            }

            foreach ($data as $key => $value) {
                if (str_starts_with($key, 'sign_') && $value === true) {
                    $signCounts[$key] = ($signCounts[$key] ?? 0) + 1;
                }
            }
        }

        return [
            'sain_count' => $sain,
            'presente_signes_count' => $presenteSignes,
            'by_sign' => $signCounts,
        ];
    }

    private function resolvePeriod(array $filters): array
    {
        return match ($filters['period'] ?? 'month') {
            'today' => [today()->startOfDay()->toDateTimeString(), today()->endOfDay()->toDateTimeString()],
            'week' => [now()->startOfWeek()->toDateTimeString(), now()->endOfWeek()->toDateTimeString()],
            'month' => [now()->startOfMonth()->toDateTimeString(), now()->endOfMonth()->toDateTimeString()],
            'custom' => [
                Carbon::parse($filters['date_from'])->startOfDay()->toDateTimeString(),
                Carbon::parse($filters['date_to'])->endOfDay()->toDateTimeString(),
            ],
            default => [now()->startOfMonth()->toDateTimeString(), now()->endOfMonth()->toDateTimeString()],
        };
    }

    private function periodHash(array $filters): string
    {
        return md5(json_encode($filters));
    }
}
