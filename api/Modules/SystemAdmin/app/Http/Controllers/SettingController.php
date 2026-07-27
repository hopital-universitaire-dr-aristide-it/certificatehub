<?php

namespace Modules\SystemAdmin\Http\Controllers;

use App\Http\Controllers\Controller;
use Modules\SystemAdmin\Http\Requests\UpdateSettingRequest;
use Modules\SystemAdmin\Models\Setting;

class SettingController extends Controller
{
    public function index()
    {
        return response()->json(['data' => Setting::all()->pluck('value', 'key')]);
    }

    public function update(UpdateSettingRequest $request, string $key)
    {
        Setting::set($key, $request->input('value'));

        return response()->json(['key' => $key, 'value' => Setting::get($key)]);
    }
}
