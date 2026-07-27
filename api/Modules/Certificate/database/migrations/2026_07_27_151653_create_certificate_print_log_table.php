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
        Schema::create('certificate_print_log', function (Blueprint $table) {
            $table->id();
            $table->foreignId('certificate_id')->constrained('certificates');
            $table->foreignId('printed_by')->constrained('users');
            $table->timestamp('printed_at');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('certificate_print_log');
    }
};
