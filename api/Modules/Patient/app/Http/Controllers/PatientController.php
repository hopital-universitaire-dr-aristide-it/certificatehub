<?php

namespace Modules\Patient\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Patient\Http\Requests\StorePatientRequest;
use Modules\Patient\Http\Requests\UpdatePatientRequest;
use Modules\Patient\Http\Resources\PatientResource;
use Modules\Patient\Http\Resources\PatientSummaryResource;
use Modules\Patient\Models\Patient;
use Modules\Patient\Services\PatientService;

class PatientController extends Controller
{
    public function __construct(private readonly PatientService $patientService) {}

    public function index()
    {
        return PatientResource::collection(Patient::orderByDesc('created_at')->paginate(20));
    }

    public function store(StorePatientRequest $request)
    {
        $result = $this->patientService->create($request->validated(), $request->user()->id);

        return response()->json([
            'patient' => new PatientResource($result['patient']),
            'potential_duplicates' => PatientSummaryResource::collection($result['potential_duplicates']),
        ], 201);
    }

    public function show(Patient $patient)
    {
        return new PatientResource($patient);
    }

    public function update(UpdatePatientRequest $request, Patient $patient)
    {
        return new PatientResource($this->patientService->update($patient, $request->validated()));
    }

    /**
     * Autocomplete temps reel (Typesense) — utilise par l'accueil et le medecin.
     */
    public function search(Request $request)
    {
        $query = $request->string('q')->toString();

        if (mb_strlen($query) < 2) {
            return PatientSummaryResource::collection([]);
        }

        $results = Patient::search($query)->take(10)->get();

        return PatientSummaryResource::collection($results);
    }
}
