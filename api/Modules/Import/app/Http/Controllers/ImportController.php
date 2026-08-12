<?php

namespace Modules\Import\Http\Controllers;

use App\Http\Controllers\Controller;
use Modules\Import\Http\Requests\ConfirmImportRequest;
use Modules\Import\Http\Requests\ParseImportRequest;
use Modules\Import\Http\Resources\ImportBatchResource;
use Modules\Import\Models\ImportBatch;
use Modules\Import\Services\ImportConfirmService;
use Modules\Import\Services\ImportParseService;

class ImportController extends Controller
{
    public function __construct(
        private readonly ImportParseService $importParseService,
        private readonly ImportConfirmService $importConfirmService,
    ) {}

    public function parse(ParseImportRequest $request)
    {
        return response()->json($this->importParseService->parse($request->file('file')));
    }

    public function confirm(ConfirmImportRequest $request)
    {
        $result = $this->importConfirmService->confirm($request->validated(), $request->user());

        return response()->json([
            'batch' => new ImportBatchResource($result['batch']),
            'doctors_created' => $result['doctors_created'],
            'patients_created' => $result['patients_created'],
            'certificates_created' => $result['certificates_created'],
        ], 201);
    }

    /**
     * Liste des lots (tags) avec leurs compteurs — utilisee pour peupler les
     * filtres par tag ailleurs dans l'app (accueil, utilisateurs, patients).
     */
    public function batches()
    {
        return ImportBatchResource::collection(
            ImportBatch::withCount(['patients', 'certificates', 'doctors'])->orderByDesc('created_at')->get()
        );
    }
}
