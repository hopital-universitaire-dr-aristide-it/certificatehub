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

    // Doivent etre declarees avant certificates/{certificate} sinon "trashed"/
    // "mine" sont interpretes comme un {certificate} et le binding de route echoue.
    Route::get('certificates/trashed', [CertificateController::class, 'trashed'])
        ->middleware('can:certificate.restore');
    Route::get('certificates/mine', [CertificateController::class, 'mine'])
        ->middleware('can:certificate.view_own');

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

    Route::get('certificates/{certificate}/invoice', [CertificateController::class, 'invoice'])
        ->middleware('can:certificate.print');

    Route::delete('certificates/{certificate}', [CertificateController::class, 'destroy'])
        ->middleware('can:certificate.delete');
    Route::post('certificates/{certificate}/restore', [CertificateController::class, 'restore'])
        ->middleware('can:certificate.restore')->withTrashed();
});
