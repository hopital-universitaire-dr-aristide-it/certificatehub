<?php

namespace Modules\Reports\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Reports\Services\CertificateReportService;

class ReportController extends Controller
{
    public function __construct(private readonly CertificateReportService $reportService) {}

    public function certificates(Request $request)
    {
        return response()->json(
            $this->reportService->summary($request->only(['period', 'date_from', 'date_to']))
        );
    }
}
