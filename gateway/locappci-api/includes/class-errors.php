<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * Errors in the app's format: { "code": "...", "message": "..." } with a French, user-safe message.
 * (WordPress's own error format adds a "data" field the app doesn't need.)
 */
final class Locappci_Errors {
	const STATUS = [
		'not_found'    => 404,
		'validation'   => 400,
		'unauthorized' => 401,
		'cart_changed' => 409,
		'unavailable'  => 503,
		'server_error' => 500,
	];

	public static function response(string $code, string $message): WP_REST_Response {
		$status = self::STATUS[$code] ?? 500;
		$res = new WP_REST_Response(['code' => $code, 'message' => $message], $status);
		self::no_cache($res);
		return $res;
	}

	public static function not_found(): WP_REST_Response {
		return self::response('not_found', "Cette annonce n'est plus disponible.");
	}

	/** Live answers (stock, cart, orders) must never be cached by LiteSpeed or the browser. */
	public static function no_cache(WP_REST_Response $res): WP_REST_Response {
		$res->header('Cache-Control', 'no-store, max-age=0');
		$res->header('X-LiteSpeed-Cache-Control', 'no-cache');
		return $res;
	}
}
