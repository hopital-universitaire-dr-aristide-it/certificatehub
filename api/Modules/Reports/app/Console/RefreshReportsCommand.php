<?php

namespace Modules\Reports\Console;

use Illuminate\Console\Command;
use Modules\Reports\Services\CertificateReportService;

class RefreshReportsCommand extends Command
{
    protected $signature = 'reports:refresh';

    protected $description = 'Vide le cache des rapports et pré-chauffe les périodes les plus consultées';

    public function handle(CertificateReportService $service): int
    {
        $service->flushCache();

        foreach (['today', 'week', 'month'] as $period) {
            $service->summary(['period' => $period]);
        }

        $this->info('Cache des rapports rafraîchi.');

        return self::SUCCESS;
    }
}
