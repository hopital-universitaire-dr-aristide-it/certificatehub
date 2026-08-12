<?php

namespace Modules\Import\Support;

use Illuminate\Support\Str;

class DoctorName
{
    /**
     * Nom normalise pour regrouper les variantes d'ecriture d'un meme
     * medecin ("Salomon", "Dr. Salomon", "Desir Harold", "Désir Harold") —
     * insensible aux accents/casse, prefixe "Dr."/"Docteur" retire, espaces
     * multiples reduits.
     */
    public static function normalize(string $raw): string
    {
        $ascii = Str::of($raw)->ascii()->lower()->trim()->toString();
        $ascii = preg_replace('/^(dr\.?|docteur)\s+/', '', $ascii) ?? $ascii;
        $ascii = preg_replace('/\s+/', ' ', $ascii) ?? $ascii;

        return trim($ascii);
    }

    /**
     * Base pour l'email/mot de passe generes ("prenomnom") — le nom
     * normalise sans espaces, uniquement des lettres. User::name est un
     * champ unique (pas de separation prenom/nom pour les medecins) : on
     * concatene simplement les mots du nom normalise, ce qui approxime
     * "prenomnom" quand le nom est ecrit "Prenom Nom".
     */
    public static function slug(string $raw): string
    {
        $slug = preg_replace('/[^a-z]/', '', self::normalize($raw)) ?? '';

        return $slug !== '' ? $slug : 'medecin';
    }
}
