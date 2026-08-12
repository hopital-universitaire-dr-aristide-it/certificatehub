<?php

namespace Modules\SystemAdmin\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\SystemAdmin\Http\Requests\AssignRoleRequest;
use Modules\SystemAdmin\Http\Requests\StoreUserRequest;
use Modules\SystemAdmin\Http\Requests\UpdateUserRequest;
use Modules\SystemAdmin\Http\Resources\UserResource;
use Modules\SystemAdmin\Services\UserService;

class UserController extends Controller
{
    public function __construct(private readonly UserService $userService) {}

    public function index(Request $request)
    {
        $importTag = $request->filled('import_tag') ? $request->string('import_tag')->toString() : null;

        return UserResource::collection($this->userService->list($importTag));
    }

    public function store(StoreUserRequest $request)
    {
        $user = $this->userService->create($request->validated());

        return new UserResource($user);
    }

    public function update(UpdateUserRequest $request, User $user)
    {
        $user = $this->userService->update($user, $request->validated());

        return new UserResource($user);
    }

    public function deactivate(User $user)
    {
        return new UserResource($this->userService->deactivate($user));
    }

    public function reactivate(User $user)
    {
        return new UserResource($this->userService->reactivate($user));
    }

    public function assignRole(AssignRoleRequest $request, User $user)
    {
        return new UserResource($this->userService->assignRole($user, $request->string('role')->toString()));
    }

    public function destroy(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            throw ValidationException::withMessages([
                'user' => 'Vous ne pouvez pas supprimer votre propre compte.',
            ]);
        }

        $this->userService->delete($user);

        return response()->noContent();
    }

    public function restore(User $user)
    {
        return new UserResource($this->userService->restore($user));
    }

    /**
     * Utilisateurs supprimes (corbeille) — reserve au superadmin, pour retablissement.
     */
    public function trashed()
    {
        return UserResource::collection(
            User::onlyTrashed()->with('roles')->orderByDesc('deleted_at')->get()
        );
    }
}
