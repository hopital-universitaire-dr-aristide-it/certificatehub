<?php

use Illuminate\Support\Facades\Route;
use Modules\FormHub\Http\Controllers\FormDefinitionController;
use Modules\FormHub\Http\Controllers\FormFieldController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function () {
    // Lecture : accessible a tout utilisateur authentifie (l'accueil et le
    // medecin doivent connaitre les formulaires actifs pour les proposer/remplir).
    Route::get('form-definitions', [FormDefinitionController::class, 'index']);
    Route::get('form-definitions/{formDefinition}/fields', [FormDefinitionController::class, 'fields']);

    // Gestion : reservee a form_field.manage (admin/superadmin).
    Route::middleware('can:form_field.manage')->group(function () {
        Route::get('form-definitions/{formDefinition}/admin-fields', [FormDefinitionController::class, 'adminFields']);
        Route::post('form-definitions/{formDefinition}/fields', [FormFieldController::class, 'store']);
        Route::patch('form-fields/{formField}/rename', [FormFieldController::class, 'rename']);
        Route::post('form-fields/{formField}/reset-label', [FormFieldController::class, 'resetLabel']);
        Route::patch('form-fields/{formField}/active', [FormFieldController::class, 'setActive']);
        Route::post('form-fields/reorder', [FormFieldController::class, 'reorder']);
    });
});
