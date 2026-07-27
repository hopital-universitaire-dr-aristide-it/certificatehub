-- docker/postgres/init.sql
-- Exécuté une seule fois à la création du container

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Fonction helper pour la recherche/dédup insensible aux accents et à la casse
CREATE OR REPLACE FUNCTION unaccent_lower(text)
RETURNS text AS $$
  SELECT unaccent(lower($1));
$$ LANGUAGE sql IMMUTABLE;

-- Base de données dédiée aux tests (phpunit.xml : DB_DATABASE=certhub_test)
-- pour ne jamais migrer/rafraîchir la base de développement en lançant les tests.
CREATE DATABASE certhub_test;

\c certhub_test

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION unaccent_lower(text)
RETURNS text AS $$
  SELECT unaccent(lower($1));
$$ LANGUAGE sql IMMUTABLE;
