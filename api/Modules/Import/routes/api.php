<?php

use Illuminate\Support\Facades\Route;
use Modules\Import\Http\Controllers\ImportController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function () {
    // Lecture seule des lots (tags) — ouverte a quiconque peut consulter des
    // certificats (accueil compris), pour alimenter le filtre par tag sur
    // "Consulter certificats" sans exposer les actions d'import elles-memes.
    Route::get('import-batches', [ImportController::class, 'batches'])->middleware('can:certificate.view');

    Route::middleware('can:import.manage')->group(function () {
        Route::post('import/parse', [ImportController::class, 'parse']);
        Route::post('import/confirm', [ImportController::class, 'confirm']);
    });
});
