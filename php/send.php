<?php
/**
 * Magyarország MarkDex — Regisztrációs űrlap kezelő
 *
 * Egyszerű PHP-handler shared hostingra.
 * Nem igényel composer-t vagy külső könyvtárat.
 *
 * Beállítás:
 *   1) Állítsa be a $TO_EMAIL értékét lent.
 *   2) Ellenőrizze, hogy a mail() funkció működik a hostingján.
 *      (Ha nem, használjon SMTP-t: pl. PHPMailer vagy Formspree-t a statikus változat szerint.)
 *   3) Válasszon: csak e-mail, csak CSV, vagy mindkettő.
 */

// ========== BEÁLLÍTÁSOK ==========
$TO_EMAIL      = 'kapcsolat@pelda.hu';              // ide érkeznek a regisztrációk
$FROM_EMAIL    = 'noreply@pelda.hu';                // feladó (a hoszting engedheti meg)
$SUBJECT       = 'Új regisztráció — Magyarország MarkDex';
$SAVE_CSV      = true;                              // mentés CSV-be is
$CSV_FILE      = __DIR__ . '/submissions.csv';      // CSV elérési út (védett legyen!)
$ALLOWED_ORIGIN = '';                               // pl. 'https://pelda.hu' — üresen hagyva minden engedélyezett
// =================================

header('Content-Type: application/json; charset=utf-8');

// --- JSON válasz segéd ---
function respond($ok, $message, $code = 200) {
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

// --- CORS (opcionális) ---
if ($ALLOWED_ORIGIN !== '') {
    header('Access-Control-Allow-Origin: ' . $ALLOWED_ORIGIN);
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;
}

// --- Csak POST ---
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Csak POST kérés engedélyezett.', 405);
}

// --- Honeypot (bot-szűrő) ---
if (!empty($_POST['website'])) {
    // Úgy teszünk, mintha sikerült volna, de nem csinálunk semmit
    respond(true, 'Köszönjük!');
}

// --- Bemenet kinyerése és tisztítása ---
$firstName = trim($_POST['firstName'] ?? '');
$lastName  = trim($_POST['lastName']  ?? '');
$email     = trim($_POST['email']     ?? '');
$phone     = trim($_POST['phone']     ?? '');
$consent   = isset($_POST['consent']);

// --- Validáció (szerver oldal) ---
$errors = [];
if (mb_strlen($firstName) < 2) $errors[] = 'keresztnév';
if (mb_strlen($lastName)  < 2) $errors[] = 'vezetéknév';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'e-mail';
if (!preg_match('/^[+0-9\s\-()]{7,}$/', $phone)) $errors[] = 'telefonszám';
if (!$consent) $errors[] = 'feltételek elfogadása';

if (!empty($errors)) {
    respond(false, 'Hibás vagy hiányzó mezők: ' . implode(', ', $errors) . '.', 400);
}

// --- Rate limiting nagyon egyszerű verzió (IP + időbélyeg) ---
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$lockFile = sys_get_temp_dir() . '/markdex_' . md5($ip);
if (file_exists($lockFile) && (time() - filemtime($lockFile)) < 10) {
    respond(false, 'Túl gyakori próbálkozás. Várjon néhány másodpercet.', 429);
}
@touch($lockFile);

// --- CSV mentés ---
if ($SAVE_CSV) {
    $row = [
        date('c'),
        $ip,
        $firstName,
        $lastName,
        $email,
        $phone,
        $_SERVER['HTTP_USER_AGENT'] ?? ''
    ];
    $needsHeader = !file_exists($CSV_FILE) || filesize($CSV_FILE) === 0;
    $fp = @fopen($CSV_FILE, 'a');
    if ($fp) {
        if ($needsHeader) {
            fputcsv($fp, ['timestamp','ip','firstName','lastName','email','phone','userAgent']);
        }
        fputcsv($fp, $row);
        fclose($fp);
        @chmod($CSV_FILE, 0600);
    }
}

// --- E-mail értesítés ---
$body = "Új regisztráció érkezett:\n\n";
$body .= "Név:        {$firstName} {$lastName}\n";
$body .= "E-mail:     {$email}\n";
$body .= "Telefon:    {$phone}\n";
$body .= "IP:         {$ip}\n";
$body .= "Időbélyeg:  " . date('Y-m-d H:i:s') . "\n";

$headers  = "From: Magyarország MarkDex <{$FROM_EMAIL}>\r\n";
$headers .= "Reply-To: {$email}\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "X-Mailer: MarkDex-Form/1.0\r\n";

$mailSent = @mail($TO_EMAIL, $SUBJECT, $body, $headers);

// Ha a mail nem megy, de CSV elment — még mindig siker
if (!$mailSent && !$SAVE_CSV) {
    respond(false, 'A küldés nem sikerült. Próbálja újra később.', 500);
}

respond(true, 'Köszönjük! Hamarosan felvesszük Önnel a kapcsolatot.');
