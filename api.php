
<?php
header("Content-Type: application/json; charset=UTF-8");

require_once "koneksi.php";

// URL Production Webhook n8n
define(
    "N8N_WEBHOOK_URL",
    "http://localhost:5678/webhook/37d97705-58e2-47c2-921f-1d173be647d3"
);

// Mengambil banyak baris dari MySQL
function getRows($conn, $sql) {
    $query = mysqli_query($conn, $sql);

    if (!$query) {
        return false;
    }

    $data = [];

    while ($row = mysqli_fetch_assoc($query)) {
        $data[] = $row;
    }

    return $data;
}

// Mengambil satu baris dari MySQL
function getOneRow($conn, $sql) {
    $query = mysqli_query($conn, $sql);

    if (!$query) {
        return false;
    }

    return mysqli_fetch_assoc($query);
}

$action = $_GET["action"] ?? "";

switch ($action) {

    case "summary":

        $data = getOneRow($conn, "
            SELECT * FROM summary_metrics
            ORDER BY id DESC
            LIMIT 1
        ");

        echo json_encode([
            "success" => true,
            "data" => $data
        ]);
        break;


    case "funnel":

        $data = getRows($conn, "
            SELECT * FROM funnel_sources
            ORDER BY id ASC
        ");

        echo json_encode([
            "success" => true,
            "data" => $data
        ]);
        break;


    case "monthly":

        $data = getRows($conn, "
            SELECT * FROM monthly_channel_traffic
            ORDER BY month_order ASC, id ASC
        ");

        echo json_encode([
            "success" => true,
            "data" => $data
        ]);
        break;


    case "daily":

        $data = getRows($conn, "
            SELECT * FROM daily_channel_traffic
            ORDER BY date ASC, id ASC
        ");

        echo json_encode([
            "success" => true,
            "data" => $data
        ]);
        break;


    // Mengirim seluruh data MySQL ke n8n
    case "send_to_n8n":

        $summary = getOneRow($conn, "
            SELECT * FROM summary_metrics
            ORDER BY id DESC
            LIMIT 1
        ");

        $funnel = getRows($conn, "
            SELECT * FROM funnel_sources
            ORDER BY id ASC
        ");

        $monthly = getRows($conn, "
            SELECT * FROM monthly_channel_traffic
            ORDER BY month_order ASC, id ASC
        ");

        $daily = getRows($conn, "
            SELECT * FROM daily_channel_traffic
            ORDER BY date ASC, id ASC
        ");

        // Periksa apakah pengambilan data berhasil
        if (
            $summary === false ||
            $funnel === false ||
            $monthly === false ||
            $daily === false
        ) {
            echo json_encode([
                "success" => false,
                "message" => "Gagal mengambil data dari MySQL"
            ]);
            break;
        }

        // Susun data yang akan dikirim
        $payload = [
            "source" => "PPDB Analytics",
            "school" => "SMPN 5 Depok",
            "event" => "ppdb_data_sync",
            "generated_at" => date("Y-m-d H:i:s"),
            "data_type" => "Data Simulasi Akademik",
            "data" => [
                "summary" => $summary,
                "funnel" => $funnel,
                "monthly" => $monthly,
                "daily" => $daily
            ]
        ];

        // Periksa ketersediaan cURL
        if (!function_exists("curl_init")) {
            echo json_encode([
                "success" => false,
                "message" => "Ekstensi PHP cURL belum aktif"
            ]);
            break;
        }

        // Kirim data ke Webhook n8n
        $ch = curl_init(N8N_WEBHOOK_URL);

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => [
                "Content-Type: application/json"
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 30
        ]);

        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        curl_close($ch);

        // Periksa hasil pengiriman
        if ($response === false) {
            echo json_encode([
                "success" => false,
                "message" => "Gagal menghubungi n8n",
                "error" => $curlError
            ]);
            break;
        }

        if ($httpCode < 200 || $httpCode >= 300) {
            echo json_encode([
                "success" => false,
                "message" => "n8n menerima respons HTTP yang tidak berhasil",
                "http_code" => $httpCode,
                "response" => $response
            ]);
            break;
        }

        echo json_encode([
            "success" => true,
            "message" => "Data PPDB berhasil dikirim ke n8n",
            "http_code" => $httpCode,
            "n8n_response" => $response
        ]);

        break;


    default:

        echo json_encode([
            "success" => false,
            "message" => "Action tidak ditemukan"
        ]);

        break;
}
?>
