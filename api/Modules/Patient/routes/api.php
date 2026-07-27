<?php

use Illuminate\Support\Facades\Route;
use Modules\Patient\Http\Controllers\PatientController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function () {
    Route::get('patients/search', [PatientController::class, 'search'])->middleware('can:patient.search');
    Route::get('patients', [PatientController::class, 'index'])->middleware('can:patient.view');
    Route::post('patients', [PatientController::class, 'store'])->middleware('can:patient.create');
    Route::get('patients/{patient}', [PatientController::class, 'show'])->middleware('can:patient.view');
    Route::put('patients/{patient}', [PatientController::class, 'update'])->middleware('can:patient.update');
});
