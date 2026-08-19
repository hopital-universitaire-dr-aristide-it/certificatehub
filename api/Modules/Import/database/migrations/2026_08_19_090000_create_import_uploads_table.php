<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Represente le depot d'un fichier JSON, distinct de sa validation
     * (ImportBatch n'existe qu'une fois la creation reelle effectuee). Permet
     * a un superadmin de deposer un fichier sans le traiter tout de suite, et
     * a quelqu'un d'autre (voir role manager_ext) de reprendre l'extraction/
     * apercu/validation plus tard — completed_at nullable suit la convention
     * deja utilisee ailleurs dans l'app (paid_at, finalized_at) plutot qu'une
     * colonne status separee.
     */
    public function up(): void
    {
        Schema::create('import_uploads', function (Blueprint $table) {
            $table->id();
            $table->string('tag');
            $table->string('original_filename')->nullable();
            $table->jsonb('raw_json');
            $table->foreignId('uploaded_by')->constrained('users');
            $table->foreignId('completed_by')->nullable()->constrained('users');
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('import_batch_id')->nullable()->constrained('import_batches')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_uploads');
    }
};
