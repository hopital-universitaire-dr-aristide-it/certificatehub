<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Force la connexion de test vers une base separee de la base de dev/prod,
     * AVANT que RefreshDatabase ne migre quoi que ce soit (setUpTraits() est
     * appele juste apres createApplication(), voir InteractsWithTestCaseLifecycle).
     *
     * Necessaire car le service "app" de docker-compose exporte DB_DATABASE
     * comme vraie variable d'environnement du conteneur : Laravel's env()
     * lit $_SERVER/$_ENV en priorite, qui gardent la valeur du conteneur
     * (certhub_db) meme quand phpunit.xml force="true" une autre valeur
     * (qui n'agit que sur putenv()/getenv()). Sans ce garde-fou, lancer les
     * tests avec RefreshDatabase migre/vide la base de DEVELOPPEMENT au lieu
     * d'une base de test dediee — deja arrive une fois pendant ce projet.
     */
    public function createApplication()
    {
        $app = parent::createApplication();

        $app['config']->set('database.connections.pgsql.database', 'certhub_test');
        $app['db']->purge('pgsql');

        $current = $app['db']->connection('pgsql')->getDatabaseName();

        if ($current !== 'certhub_test') {
            throw new \RuntimeException(
                "Garde-fou test DB : connexion pgsql pointe vers '{$current}' au lieu de 'certhub_test'. ".
                'Ne JAMAIS lancer les tests sans cette verification (risque de vider la base de dev).'
            );
        }

        return $app;
    }
}
