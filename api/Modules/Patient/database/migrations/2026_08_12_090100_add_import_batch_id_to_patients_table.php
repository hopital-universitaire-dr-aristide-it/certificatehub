<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pose uniquement sur les patients nouvellement crees par un import — un
     * patient reutilise par dedoublonnage (voir DeduplicationService) garde
     * son import_batch_id d'origine (ou null s'il existait deja avant tout
     * import), il n'est jamais rattache au nouveau lot.
     */
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->foreignId('import_batch_id')->nullable()->after('created_by')->constrained('import_batches')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropConstrainedForeignId('import_batch_id');
        });
    }
};
