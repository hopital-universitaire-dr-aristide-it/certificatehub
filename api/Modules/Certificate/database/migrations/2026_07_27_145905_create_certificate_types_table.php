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
        Schema::create('certificate_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_definition_id')->constrained('form_definitions');
            $table->boolean('is_active')->default(true);
            $table->decimal('fee_amount', 10, 2)->default(0);
            $table->string('numbering_prefix')->nullable();
            // Valeur de depart configurable par l'admin (ex: continuer une
            // numerotation papier existante au lieu de redemarrer a 0/1).
            $table->unsignedBigInteger('numbering_next_value')->default(1);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('certificate_types');
    }
};
