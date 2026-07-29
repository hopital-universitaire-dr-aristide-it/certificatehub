<?php

use Illuminate\Support\Facades\Route;
use Modules\Reception\Http\Controllers\ReceptionController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function () {
    Route::get('visits', [ReceptionController::class, 'index'])->middleware('can:certificate.view');
    Route::post('visits', [ReceptionController::class, 'store'])->middleware('can:certificate.create');
    Route::post('visits/{certificate}/mark-paid', [ReceptionController::class, 'markPaid'])->middleware('can:certificate.mark_paid');
    Route::post('visits/{certificate}/cancel-payment', [ReceptionController::class, 'cancelPayment'])->middleware('can:certificate.cancel_payment');
});
