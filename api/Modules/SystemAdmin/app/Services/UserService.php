<?php

namespace Modules\SystemAdmin\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Hash;

class UserService
{
    public function list(): Collection
    {
        return User::with('roles')->orderBy('name')->get();
    }

    public function create(array $data): User
    {
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'is_active' => true,
        ]);

        $user->assignRole($data['role']);

        return $user->load('roles');
    }

    public function update(User $user, array $data): User
    {
        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        $user->update(array_intersect_key($data, array_flip(['name', 'email', 'password'])));

        return $user->fresh('roles');
    }

    public function deactivate(User $user): User
    {
        $user->update(['is_active' => false]);
        $user->tokens()->delete();

        return $user->fresh('roles');
    }

    public function reactivate(User $user): User
    {
        $user->update(['is_active' => true]);

        return $user->fresh('roles');
    }

    public function delete(User $user): void
    {
        $user->tokens()->delete();
        $user->delete();
    }

    public function restore(User $user): User
    {
        $user->restore();

        return $user->fresh('roles');
    }

    public function assignRole(User $user, string $role): User
    {
        $user->syncRoles([$role]);

        return $user->fresh('roles');
    }
}
