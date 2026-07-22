<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
$upc = $_GET['upc'] ?? '';
if(!$upc) {
    echo json_encode(['error' => 'No UPC provided']);
    exit;
}
$url = "https://api.upcitemdb.com/prod/trial/lookup?upc=" . urlencode($upc);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36');
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

$result = curl_exec($ch);
if($result === false) {
    echo json_encode(['error' => 'cURL Error: ' . curl_error($ch)]);
} else {
    echo $result;
}
curl_close($ch);
?>
