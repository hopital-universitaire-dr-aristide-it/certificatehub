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

        .certnum { text-align: center; font-size: 10px; color: #555; margin-bottom: 8px; }
        .date-line { text-align: right; margin-bottom: 20px; }

        p { line-height: 1.6; text-align: justify; }

        table.identity { width: 100%; margin: 15px 0; border-collapse: collapse; }
        table.identity td { padding: 3px 0; vertical-align: top; }
        table.identity td.label { width: 220px; font-weight: bold; }

        ul.signs { margin: 10px 0; padding-left: 20px; }
        ul.signs li { margin-bottom: 4px; }

        .recommandation { margin-top: 15px; }

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

    <div class="title">Certificat de santé</div>

    @if($certificateNumber)
        <div class="certnum">N° {{ $certificateNumber }}</div>
    @endif

    <div class="date-line">Tabarre, le {{ $issuedDate }}</div>

    <p>
        Je, soussigné, Dr. {{ $doctorName }}, Docteur en Médecine, affecté à l'Hôpital Universitaire
        Dr. Aristide, certifie avoir examiné le patient dont l'identité suit :
    </p>

    <table class="identity">
        <tr>
            <td class="label">Nom et prénom</td>
            <td>{{ $patient['full_name'] }}</td>
        </tr>
        <tr>
            <td class="label">Date de naissance ou Age</td>
            <td>{{ $patient['date_of_birth_or_age'] }}</td>
        </tr>
        <tr>
            <td class="label">Résidence</td>
            <td>{{ $patient['residence'] }}</td>
        </tr>
    </table>

    @if($outcome === 'presente_signes')
        <p>{{ $patient['full_name'] }} présente :</p>
        <ul class="signs">
            @foreach($checkedSigns as $signLabel)
                <li>{{ $signLabel }}</li>
            @endforeach
        </ul>
    @else
        <p>
            {{ $patient['full_name'] }} ne présente aucun signe évocateur de maladies contagieuses ou
            transmissibles, ni de signes de maladies chroniques ou débilitantes. {{ ucfirst($patient['pronoun']) }}
            ne présente pas non plus de signes de trouble mental.
        </p>
    @endif

    <p>Ce certificat lui est délivré pour servir à toutes fins utiles.</p>

    @if($outcome === 'presente_signes')
        <p class="recommandation"><strong>Recommandations :</strong> Consulter un spécialiste</p>
    @endif

    <table class="signatures">
        <tr>
            <td><div class="sig-line"></div></td>
            <td><div class="sig-line"></div></td>
        </tr>
        <tr>
            <td class="label">Prestataire</td>
            <td class="label">{{ $directeurMedicalName }}<br>Directeur Médical</td>
        </tr>
    </table>
</body>
</html>
