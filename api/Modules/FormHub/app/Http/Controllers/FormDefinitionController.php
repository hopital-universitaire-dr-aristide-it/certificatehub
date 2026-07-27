<?php

namespace Modules\FormHub\Http\Controllers;

use App\Http\Controllers\Controller;
use Modules\FormHub\Http\Resources\FormDefinitionResource;
use Modules\FormHub\Http\Resources\FormFieldAdminResource;
use Modules\FormHub\Http\Resources\FormFieldResource;
use Modules\FormHub\Models\FormDefinition;

class FormDefinitionController extends Controller
{
    /**
     * Formulaires actifs — accessible a tout utilisateur authentifie
     * (l'accueil et le medecin doivent savoir quels formulaires existent).
     */
    public function index()
    {
        return FormDefinitionResource::collection(
            FormDefinition::where('is_active', true)->orderBy('label')->get()
        );
    }

    /**
     * Arbre des champs actifs d'un formulaire — utilise pour le rendu
     * dynamique cote medecin/accueil.
     */
    public function fields(FormDefinition $formDefinition)
    {
        return FormFieldResource::collection($formDefinition->activeFieldTree());
    }

    /**
     * Arbre complet (actifs + inactifs) — reserve a l'admin pour le hub de
     * configuration des formulaires.
     */
    public function adminFields(FormDefinition $formDefinition)
    {
        $tree = $formDefinition->fields()
            ->whereNull('parent_field_id')
            ->with('children.children')
            ->orderBy('sort_order')
            ->get();

        return FormFieldAdminResource::collection($tree);
    }
}
