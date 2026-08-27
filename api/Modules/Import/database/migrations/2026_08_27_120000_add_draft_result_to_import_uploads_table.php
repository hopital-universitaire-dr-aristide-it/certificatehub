<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cache de l'apercu edite (patients/medecins/certificats corriges) —
     * meme forme que la reponse de ImportController::parse(). Rempli par
     * ImportController::saveDraft() au fil des corrections, pour que
     * reprendre un import en cours reparte de l'etat corrige plutot que de
     * reparser raw_json a zero. Efface a null une fois l'import valide
     * (ImportConfirmService::confirm), et ignore par parse() tant qu'il est
     * null.
     */
    public function up(): void
    {
        Schema::table('import_uploads', function (Blueprint $table) {
            $table->jsonb('draft_result')->nullable()->after('raw_json');
        });
    }

    public function down(): void
    {
        Schema::table('import_uploads', function (Blueprint $table) {
            $table->dropColumn('draft_result');
        });
    }
};
