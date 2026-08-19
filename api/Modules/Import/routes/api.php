<?php

use Illuminate\Support\Facades\Route;
use Modules\Import\Http\Controllers\ImportController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function () {
    // Lecture seule des lots (tags) — ouverte a quiconque peut consulter des
    // certificats (accueil compris), pour alimenter le filtre par tag sur
    // "Consulter certificats" sans exposer les actions d'import elles-memes.
    Route::get('import-batches', [ImportController::class, 'batches'])->middleware('can:certificate.view');

    // Depot d'un nouveau JSON — reserve au superadmin.
    Route::middleware('can:import.manage')->group(function () {
        Route::post('import/uploads', [ImportController::class, 'store']);
    });

    // Reprise (extraction/apercu/validation) d'un upload deja depose —
    // superadmin ou manager_ext (le superadmin recoit import.review
    // automatiquement via la synchronisation "toutes permissions").
    Route::middleware('can:import.review')->group(function () {
        Route::get('import/uploads', [ImportController::class, 'index']);
        Route::get('import/uploads/{upload}/parse', [ImportController::class, 'parse']);
        Route::post('import/uploads/{upload}/confirm', [ImportController::class, 'confirm']);
    });
});
