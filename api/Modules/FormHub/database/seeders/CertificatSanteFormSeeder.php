<?php

namespace Modules\FormHub\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\FormHub\Enums\FieldType;
use Modules\FormHub\Models\FormDefinition;
use Modules\FormHub\Models\FormField;

/**
 * Fusionne les deux variantes du "Certificat de santé" (sain / présente des
 * signes) en un seul formulaire configurable — voir le plan
 * warm-wandering-popcorn.md. field_key est immuable une fois seede
 * (ADR-020) ; seul `label` est renommable depuis le hub admin.
 */
class CertificatSanteFormSeeder extends Seeder
{
    public function run(): void
    {
        $form = FormDefinition::firstOrCreate(
            ['context_key' => 'certificate.sante'],
            [
                'module' => 'Certificate',
                'label' => 'Certificat de santé',
                'description' => 'Certificat attestant qu\'un patient présente ou non des signes de maladies contagieuses, chroniques, débilitantes ou de trouble mental.',
                'is_active' => true,
            ]
        );

        $fields = [
            [
                'field_key' => 'outcome',
                'label' => "Résultat de l'examen",
                'field_type' => FieldType::Select,
                'is_required' => true,
                'sort_order' => 0,
                'config' => [
                    'options' => [
                        ['value' => 'sain', 'label' => 'Sain — ne présente aucun signe'],
                        ['value' => 'presente_signes', 'label' => 'Présente des signes'],
                    ],
                ],
            ],
            [
                'field_key' => 'sign_contagieux',
                'label' => 'Signes évocateurs de maladies contagieuses ou transmissibles',
                'field_type' => FieldType::Boolean,
                'sort_order' => 1,
                'config' => ['visible_when' => ['outcome' => 'presente_signes']],
            ],
            [
                'field_key' => 'sign_chronique',
                'label' => 'Signes évocateurs de maladies chroniques',
                'field_type' => FieldType::Boolean,
                'sort_order' => 2,
                'config' => ['visible_when' => ['outcome' => 'presente_signes']],
            ],
            [
                'field_key' => 'sign_debilitant',
                'label' => 'Signes évocateurs de maladies débilitantes',
                'field_type' => FieldType::Boolean,
                'sort_order' => 3,
                'config' => ['visible_when' => ['outcome' => 'presente_signes']],
            ],
            [
                'field_key' => 'sign_trouble_mental',
                'label' => 'Signes évocateurs de trouble mental',
                'field_type' => FieldType::Boolean,
                'sort_order' => 4,
                'config' => ['visible_when' => ['outcome' => 'presente_signes']],
            ],
            [
                'field_key' => 'recommandation',
                'label' => 'Recommandations',
                'field_type' => FieldType::Textarea,
                'sort_order' => 5,
                'config' => ['visible_when' => ['outcome' => 'presente_signes'], 'placeholder' => 'Ex: Consulter un spécialiste'],
            ],
        ];

        foreach ($fields as $field) {
            FormField::firstOrCreate(
                ['form_id' => $form->id, 'parent_field_id' => null, 'field_key' => $field['field_key']],
                [
                    'default_label' => $field['label'],
                    'label' => $field['label'],
                    'field_type' => $field['field_type'],
                    'is_required' => $field['is_required'] ?? false,
                    'is_active' => true,
                    'sort_order' => $field['sort_order'],
                    'config' => $field['config'] ?? null,
                ]
            );
        }

        // La recommandation est desormais un texte fige imprime automatiquement
        // (voir CertificatePrintService/certificate-sante.blade.php), plus une
        // saisie libre du medecin — desactive le champ meme s'il a deja ete
        // seede actif lors d'un deploiement precedent.
        FormField::where('form_id', $form->id)->where('field_key', 'recommandation')->update(['is_active' => false]);
    }
}
