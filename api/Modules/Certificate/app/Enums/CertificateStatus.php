<?php

namespace Modules\Certificate\Enums;

enum CertificateStatus: string
{
    case Draft = 'draft';
    case Finalized = 'finalized';
}
