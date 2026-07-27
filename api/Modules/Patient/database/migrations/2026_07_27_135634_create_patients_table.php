<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->string('first_name');
            $table->string('last_name');
            $table->date('date_of_birth')->nullable();
            $table->unsignedSmallInteger('age')->nullable();
            $table->string('residence')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['last_name', 'first_name']);
        });

        // Index trigram pour la recherche/dedup insensible aux accents et a la casse
        // (unaccent_lower() defini dans docker/postgres/init.sql).
        DB::statement(
            'CREATE INDEX patients_full_name_trgm_idx ON patients '.
            "USING gin (unaccent_lower(first_name || ' ' || last_name) gin_trgm_ops)"
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
