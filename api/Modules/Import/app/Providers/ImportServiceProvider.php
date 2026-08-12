<?php

namespace Modules\Import\Providers;

use Nwidart\Modules\Support\ModuleServiceProvider;

class ImportServiceProvider extends ModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Import';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'import';

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        EventServiceProvider::class,
        RouteServiceProvider::class,
    ];
}
