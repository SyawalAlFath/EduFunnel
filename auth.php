
<?php
session_start();

header("Content-Type: application/json; charset=UTF-8");

require_once "koneksi.php";

$input = json_decode(file_get_contents("php://input"), true);

$action = $input["action"] ?? "";

function response($success, $message, $data = null) {
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    response(false, "Metode request tidak diizinkan");
}

/* REGISTER */
if ($action === "register") {

    $full_name = trim($input["full_name"] ?? "");
    $email = trim($input["email"] ?? "");
    $password = $input["password"] ?? "";

    if ($full_name === "" || $email === "" || $password === "") {
        response(false, "Semua kolom wajib diisi");
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        response(false, "Format email tidak valid");
    }

    if (strlen($password) < 8) {
        response(false, "Password minimal 8 karakter");
    }

    $check = mysqli_prepare(
        $conn,
        "SELECT id FROM admins WHERE email = ?"
    );

    mysqli_stmt_bind_param($check, "s", $email);
    mysqli_stmt_execute($check);
    mysqli_stmt_store_result($check);

    if (mysqli_stmt_num_rows($check) > 0) {
        response(false, "Email sudah terdaftar");
    }

    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    $stmt = mysqli_prepare(
        $conn,
        "INSERT INTO admins (full_name, email, password)
         VALUES (?, ?, ?)"
    );

    mysqli_stmt_bind_param(
        $stmt,
        "sss",
        $full_name,
        $email,
        $hashed_password
    );

    if (mysqli_stmt_execute($stmt)) {
        response(true, "Registrasi admin berhasil");
    }

    response(false, "Registrasi gagal");
}

/* LOGIN */
if ($action === "login") {

    $email = trim($input["email"] ?? "");
    $password = $input["password"] ?? "";

    $stmt = mysqli_prepare(
        $conn,
        "SELECT id, full_name, email, password
         FROM admins
         WHERE email = ?"
    );

    mysqli_stmt_bind_param($stmt, "s", $email);
    mysqli_stmt_execute($stmt);

    $result = mysqli_stmt_get_result($stmt);
    $admin = mysqli_fetch_assoc($result);

    if (!$admin || !password_verify($password, $admin["password"])) {
        response(false, "Email atau password salah");
    }

    session_regenerate_id(true);

    $_SESSION["admin_id"] = $admin["id"];
    $_SESSION["admin_name"] = $admin["full_name"];

    response(true, "Login berhasil", [
        "id" => $admin["id"],
        "full_name" => $admin["full_name"],
        "email" => $admin["email"]
    ]);
}

/* CHECK SESSION */
if ($action === "check") {

    if (!isset($_SESSION["admin_id"])) {
        response(false, "Belum login");
    }

    response(true, "Session aktif", [
        "id" => $_SESSION["admin_id"],
        "full_name" => $_SESSION["admin_name"]
    ]);
}

/* LOGOUT */
if ($action === "logout") {

    $_SESSION = [];
    session_destroy();

    response(true, "Logout berhasil");
}

response(false, "Action tidak ditemukan");
?>
