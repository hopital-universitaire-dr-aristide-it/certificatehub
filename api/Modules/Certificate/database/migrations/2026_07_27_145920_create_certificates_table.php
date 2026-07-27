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
        Schema::create('certificates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients');
            $table->foreignId('certificate_type_id')->constrained('certificate_types');
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('doctor_id')->nullable()->constrained('users');
            // Copie du tarif au moment de la creation : garantit l'exactitude
            // des KPIs de revenu meme si certificate_types.fee_amount change ensuite.
            $table->decimal('fee_amount', 10, 2);
            $table->string('certificate_number')->nullable()->unique();
            $table->jsonb('data')->nullable();
            $table->string('status')->default('draft');
            $table->string('payment_status')->default('unpaid');
            $table->timestamp('finalized_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'payment_status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('certificates');
    }
};
