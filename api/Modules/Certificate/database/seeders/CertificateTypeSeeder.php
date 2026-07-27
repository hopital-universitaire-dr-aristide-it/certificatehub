<?php

namespace Modules\Certificate\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Certificate\Models\CertificateType;
use Modules\FormHub\Models\FormDefinition;

class CertificateTypeSeeder extends Seeder
{
    public function run(): void
    {
        $form = FormDefinition::where('context_key', 'certificate.sante')->first();

        if (! $form) {
            return;
        }

        CertificateType::firstOrCreate(
            ['form_definition_id' => $form->id],
            [
                'is_active' => true,
                'fee_amount' => 500,
                'numbering_prefix' => 'CS',
                // Ne jamais démarrer à 1 : un numéro bas trahit immédiatement
                // qu'un système vient d'être mis en service. Valeur de départ
                // arbitraire ici (à remplacer par l'admin via
                // PUT /certificate-types/{id} pour poursuivre une numérotation
                // papier existante, voir README déploiement).
                'numbering_next_value' => 4827,
            ]
        );
    }
}
