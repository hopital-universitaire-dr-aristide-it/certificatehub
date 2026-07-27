<?php

use Illuminate\Support\Facades\Route;
use Modules\Certificate\Http\Controllers\CertificateController;
use Modules\Certificate\Http\Controllers\CertificateTypeController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function () {
    // Lecture ouverte a tout utilisateur authentifie : l'accueil doit voir
    // les types actifs + leurs tarifs pour enregistrer une visite.
    Route::get('certificate-types', [CertificateTypeController::class, 'index']);

    Route::middleware('can:certificate_type.manage')->group(function () {
        Route::post('certificate-types', [CertificateTypeController::class, 'store']);
        Route::put('certificate-types/{certificateType}', [CertificateTypeController::class, 'update']);
    });

    // Cote medecin : prise en charge, remplissage et finalisation.
    Route::middleware('can:certificate.finalize')->group(function () {
        Route::get('certificates/queue', [CertificateController::class, 'queue']);
        Route::get('certificates/{certificate}', [CertificateController::class, 'show']);
        Route::put('certificates/{certificate}', [CertificateController::class, 'update']);
        Route::get('certificates/{certificate}/preview', [CertificateController::class, 'preview']);
        Route::post('certificates/{certificate}/finalize', [CertificateController::class, 'finalize']);
    });

    Route::get('certificates/{certificate}/print', [CertificateController::class, 'print'])
        ->middleware('can:certificate.print');
});
