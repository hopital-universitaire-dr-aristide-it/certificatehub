<?php

namespace Modules\Import\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Import\Http\Requests\ConfirmImportRequest;
use Modules\Import\Http\Requests\StoreImportUploadRequest;
use Modules\Import\Http\Resources\ImportBatchResource;
use Modules\Import\Http\Resources\ImportUploadResource;
use Modules\Import\Models\ImportBatch;
use Modules\Import\Models\ImportUpload;
use Modules\Import\Services\ImportConfirmService;
use Modules\Import\Services\ImportParseService;

class ImportController extends Controller
{
    public function __construct(
        private readonly ImportParseService $importParseService,
        private readonly ImportConfirmService $importConfirmService,
    ) {}

    /**
     * Depot d'un nouveau fichier — reserve a import.manage (superadmin). Ne
     * fait qu'enregistrer le JSON brut ; l'extraction/apercu n'a lieu que
     * plus tard, quand quelqu'un (superadmin ou manager_ext) reprend cet
     * upload — voir parse()/confirm() ci-dessous.
     */
    public function store(StoreImportUploadRequest $request)
    {
        $file = $request->file('file');
        $contents = file_get_contents($file->getRealPath());
        $decoded = $contents !== false ? json_decode($contents, true) : null;

        if (! is_array($decoded)) {
            throw ValidationException::withMessages([
                'file' => 'Le fichier n\'est pas un JSON valide.',
            ]);
        }

        $upload = ImportUpload::create([
            'tag' => $request->string('tag')->toString(),
            'original_filename' => $file->getClientOriginalName(),
            'raw_json' => $decoded,
            'uploaded_by' => $request->user()->id,
        ]);

        return new ImportUploadResource($upload->load('uploadedBy'));
    }

    /**
     * File des imports en attente (par defaut) ou completes — visible a
     * import.manage et import.review (superadmin et manager_ext).
     */
    public function index(Request $request)
    {
        $query = ImportUpload::with(['uploadedBy', 'completedBy'])->orderByDesc('created_at');

        $query->when(
            $request->boolean('completed', false),
            fn ($q) => $q->whereNotNull('completed_at'),
            fn ($q) => $q->whereNull('completed_at'),
        );

        return ImportUploadResource::collection($query->get());
    }

    /**
     * Rejoue l'extraction sur le JSON deja stocke — sans effet de bord,
     * peut etre appele plusieurs fois (ex: si l'apercu doit etre rafraichi
     * apres qu'un medecin ait ete cree entre-temps).
     */
    public function parse(ImportUpload $upload)
    {
        return response()->json($this->importParseService->parse($upload->raw_json));
    }

    /**
     * Supprime un depot en attente — reserve a import.manage. Un import deja
     * valide ne peut plus etre supprime : il est lie a un lot et a des
     * patients/certificats reellement crees en base, dont on veut garder la
     * tracabilite.
     */
    public function destroy(ImportUpload $upload)
    {
        if ($upload->completed_at !== null) {
            throw ValidationException::withMessages([
                'upload' => 'Cet import a deja ete valide et ne peut plus etre supprime.',
            ]);
        }

        $upload->delete();

        return response()->noContent();
    }

    public function confirm(ConfirmImportRequest $request, ImportUpload $upload)
    {
        $result = $this->importConfirmService->confirm($request->validated(), $request->user(), $upload);

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
