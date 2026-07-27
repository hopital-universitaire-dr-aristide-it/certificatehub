<?php

use Illuminate\Support\Facades\Route;
use Modules\SystemAdmin\Http\Controllers\SettingController;
use Modules\SystemAdmin\Http\Controllers\SystemController;
use Modules\SystemAdmin\Http\Controllers\UserController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function () {
    Route::get('users', [UserController::class, 'index'])->middleware('can:user.view');
    Route::post('users', [UserController::class, 'store'])->middleware('can:user.create');
    Route::put('users/{user}', [UserController::class, 'update'])->middleware('can:user.update');
    Route::post('users/{user}/deactivate', [UserController::class, 'deactivate'])->middleware('can:user.deactivate');
    Route::post('users/{user}/reactivate', [UserController::class, 'reactivate'])->middleware('can:user.deactivate');
    Route::post('users/{user}/role', [UserController::class, 'assignRole'])->middleware('can:role.assign');

    Route::get('system/health', [SystemController::class, 'health'])->middleware('can:system.health.view');
    Route::get('system/logs', [SystemController::class, 'logs'])->middleware('can:system.logs.view');

    Route::middleware('can:settings.manage')->group(function () {
        Route::get('settings', [SettingController::class, 'index']);
        Route::put('settings/{key}', [SettingController::class, 'update']);
    });
});
