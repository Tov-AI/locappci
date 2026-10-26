<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path !== '/' && file_exists(__DIR__ . '/site' . $path) && !is_dir(__DIR__ . '/site' . $path)) return false;
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/site/index.php';
