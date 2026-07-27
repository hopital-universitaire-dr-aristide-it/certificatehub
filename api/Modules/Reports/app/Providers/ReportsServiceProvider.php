<?php

namespace Modules\Reports\Providers;

use Illuminate\Console\Scheduling\Schedule;
use Modules\Reports\Console\RefreshReportsCommand;
use Nwidart\Modules\Support\ModuleServiceProvider;

class ReportsServiceProvider extends ModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Reports';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'reports';

    /**
     * Command classes to register.
     *
     * @var string[]
     */
    protected array $commands = [
        RefreshReportsCommand::class,
    ];

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        EventServiceProvider::class,
        RouteServiceProvider::class,
    ];

    /**
     * Define module schedules.
     */
    protected function configureSchedules(Schedule $schedule): void
    {
        $schedule->command('reports:refresh')->dailyAt('02:00')->onOneServer();
    }
}
