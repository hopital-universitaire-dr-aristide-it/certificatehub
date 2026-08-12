<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pose uniquement sur les comptes medecin nouvellement crees par un
     * import — un compte reutilise (medecin deja enregistre, associe
     * manuellement lors de l'apercu) garde son import_batch_id d'origine.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('import_batch_id')->nullable()->after('is_active')->constrained('import_batches')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('import_batch_id');
        });
    }
};
