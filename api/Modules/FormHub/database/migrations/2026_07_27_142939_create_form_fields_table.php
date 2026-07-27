<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('form_fields', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('form_id')->constrained('form_definitions');
            $table->uuid('parent_field_id')->nullable();
            $table->string('field_key');
            $table->string('default_label');
            $table->string('label');
            $table->string('field_type');
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->smallInteger('sort_order')->default(0);
            $table->jsonb('config')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->unique(['form_id', 'parent_field_id', 'field_key']);
            $table->index(['form_id', 'parent_field_id', 'sort_order']);
        });

        // FK auto-referencee ajoutee apres coup : Postgres/Laravel ne peut pas
        // toujours resoudre une contrainte self-referencee dans le meme
        // Schema::create() (la PK n'est pas encore garantie disponible au
        // moment ou l'ALTER de la FK s'execute).
        Schema::table('form_fields', function (Blueprint $table) {
            $table->foreign('parent_field_id')->references('id')->on('form_fields');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('form_fields');
    }
};
