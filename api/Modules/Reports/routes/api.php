<?php

use Illuminate\Support\Facades\Route;
use Modules\Reports\Http\Controllers\ReportController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function () {
    Route::get('reports/certificates', [ReportController::class, 'certificates'])->middleware('can:report.view');
});
