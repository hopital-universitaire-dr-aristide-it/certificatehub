<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 30mm 25mm; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 13.5px; color: #111; }

        .header { text-align: center; padding-bottom: 14px; margin-bottom: 20px; border-bottom: 2px solid #111; }
        .header h1 { text-align: center; font-size: 22px; font-weight: bold; margin: 0 0 6px 0; letter-spacing: 0.5px; }
        .header p { text-align: center; margin: 1px 0; font-size: 10px; color: #444; }

        .title { text-align: center; font-size: 13px; font-weight: bold; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 1px; }

        .invoicenum { text-align: center; font-size: 10px; color: #555; margin-bottom: 8px; }
        .date-line { text-align: right; margin-bottom: 20px; }

        table.identity { width: 100%; margin: 15px 0; border-collapse: collapse; }
        table.identity td { padding: 5px 0; vertical-align: top; }
        table.identity td.label { width: 220px; font-weight: bold; }

        table.amount { width: 100%; margin: 30px 0; border-collapse: collapse; border-top: 1px solid #111; border-bottom: 1px solid #111; }
        table.amount td { padding: 12px 0; }
        table.amount td.label { font-weight: bold; font-size: 15px; }
        table.amount td.value { text-align: right; font-weight: bold; font-size: 15px; }

        table.signatures { width: 100%; margin-top: 70px; border-collapse: collapse; }
        table.signatures td { width: 50%; text-align: center; padding: 0; }
        .sig-line { border-top: 1px solid #111; height: 1px; margin: 0 25px; }
        table.signatures td.label { padding-top: 6px; font-size: 11px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Hôpital Universitaire Dr. Aristide</h1>
        <p>Avenue Hôpital Dr. Aristide / Tabarre 48</p>
        <p>Tabarre Haïti, w.i.</p>
        <p>Tel +509 2817-3202 / 2949-3202</p>
    </div>

    <div class="title">Reçu de paiement</div>

    <div class="invoicenum">N° {{ $invoiceNumber }}</div>

    <div class="date-line">Tabarre, le {{ $paidDate }}</div>

    <table class="identity">
        <tr>
            <td class="label">Patient</td>
            <td>{{ $patientName }}</td>
        </tr>
        <tr>
            <td class="label">Document</td>
            <td>{{ $certificateLabel }}</td>
        </tr>
        <tr>
            <td class="label">Reçu par</td>
            <td>{{ $receivedBy }}</td>
        </tr>
    </table>

    <table class="amount">
        <tr>
            <td class="label">Montant payé</td>
            <td class="value">{{ $feeAmount }} HTG</td>
        </tr>
    </table>

    <p>Ce reçu atteste du paiement effectué à l'accueil de l'Hôpital Universitaire Dr. Aristide.</p>

    <table class="signatures">
        <tr>
            <td><div class="sig-line"></div></td>
        </tr>
        <tr>
            <td class="label">Signature — Accueil</td>
        </tr>
    </table>
</body>
</html>
