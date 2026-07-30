<?php

namespace Modules\SystemAdmin\Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    private const GUARD = 'sanctum';

    /**
     * Permissions par role. Convention de nommage : {resource}.{action}.
     * superadmin recoit toutes les permissions listees ici, quel que soit le role.
     */
    private array $rolePermissions = [
        'reception' => [
            'auth.login', 'auth.logout', 'auth.change_own_password',
            'patient.view', 'patient.create', 'patient.update', 'patient.search',
            'certificate.view', 'certificate.create', 'certificate.mark_paid', 'certificate.print',
        ],
        'doctor' => [
            'auth.login', 'auth.logout', 'auth.change_own_password',
            'patient.view', 'patient.search',
            'certificate.view_own', 'certificate.finalize',
        ],
        'it' => [
            'auth.login', 'auth.logout', 'auth.change_own_password',
            'system.logs.view', 'system.health.view',
        ],
        'admin' => [
            'auth.login', 'auth.logout', 'auth.change_own_password', 'auth.reset_user_password',
            'form_field.manage', 'certificate_type.manage', 'settings.manage',
            'user.view', 'user.create', 'user.update', 'user.deactivate', 'role.assign',
            'report.view', 'certificate.print',
        ],
        // superadmin: toutes les permissions, assignees ci-dessous sans liste explicite
        'superadmin' => [],
    ];

    /**
     * Permissions exclusives au superadmin (suppression douce / retablissement) —
     * n'apparaissent dans aucune liste de $rolePermissions ci-dessus, donc
     * jamais accordees a reception/doctor/admin/it.
     */
    private array $superadminOnlyPermissions = [
        'user.delete', 'user.restore',
        'certificate.manage_all',
    ];

    /**
     * Permissions "annuler une action" (certificat, paiement, patient) —
     * partagees par superadmin/admin/it pour pouvoir defaire une erreur de
     * l'accueil ou du medecin. Volontairement absentes des listes reception/
     * doctor ci-dessus : ni l'un ni l'autre ne peut annuler sa propre action
     * seul, ca doit passer par un role de supervision.
     */
    private array $oversightPermissions = [
        'certificate.view', 'patient.view',
        'certificate.delete', 'certificate.restore', 'certificate.cancel_payment',
        'patient.delete', 'patient.restore',
    ];

    /**
     * Roles qui recoivent en plus $oversightPermissions.
     */
    private array $oversightRoles = ['admin', 'it'];

    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $allPermissions = collect($this->rolePermissions)->flatten()
            ->merge($this->superadminOnlyPermissions)
            ->merge($this->oversightPermissions)
            ->unique()->values();

        foreach ($allPermissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => self::GUARD]);
        }

        foreach (array_keys($this->rolePermissions) as $roleName) {
            $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => self::GUARD]);

            if ($roleName === 'superadmin') {
                $role->syncPermissions(Permission::where('guard_name', self::GUARD)->get());

                continue;
            }

            $permissions = $this->rolePermissions[$roleName];

            if (in_array($roleName, $this->oversightRoles, true)) {
                $permissions = array_unique(array_merge($permissions, $this->oversightPermissions));
            }

            $role->syncPermissions($permissions);
        }
    }
}
