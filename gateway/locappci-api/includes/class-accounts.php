<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * Customer accounts for the app: sign in with the website's account (phone or e-mail + password),
 * create a customer account, sign out, delete the account.
 *
 * Sessions: the app receives a random token once and sends it back in the X-Locappci-Token header.
 * Only a SHA-256 hash of the token is stored (user meta), so a database leak does not give sessions away.
 * The Authorization header is not used on purpose: Simple JWT Login reads it and would reject our token.
 *
 * Passwords are checked with WordPress's own hashing and are never stored or logged here.
 * Administrators and shop managers cannot sign in through the app (their accounts keep the
 * website's own protections, e.g. Wordfence 2FA).
 */
final class Locappci_Accounts {
	const META = '_locappci_app_tokens';
	const SIGNUP_META = '_locappci_app_signup';
	const TTL = 90 * DAY_IN_SECONDS;      // A session ends 90 days after its last use.
	const MAX_SESSIONS = 5;               // Phones signed in at the same time, per account.
	const MIN_PASSWORD = 8;
	const BAD_LOGIN = 'Identifiant ou mot de passe incorrect.';
	const TOO_MANY = 'Trop de tentatives. Réessayez dans quelques minutes.';

	/* ---------- Phone numbers (same rule as src/utils/phone.ts in the app) ---------- */

	/** "0700000001" (10 local digits) for a valid Ivorian number, or '' . */
	public static function local_phone(string $input): string {
		$digits = preg_replace('/\D+/', '', $input);
		if (strpos($digits, '00225') === 0) {
			$digits = substr($digits, 5);
		} elseif (strpos($digits, '225') === 0 && strlen($digits) === 13) {
			$digits = substr($digits, 3);
		}
		return preg_match('/^(01|05|07|21|25|27)\d{8}$/', $digits) ? $digits : '';
	}

	/** The app's format: "2250700000001", or '' when the account has no valid Ivorian number. */
	private static function app_phone(int $user_id): string {
		foreach (['billing_phone', 'phone'] as $key) {
			$local = self::local_phone((string) get_user_meta($user_id, $key, true));
			if ($local !== '') {
				return '225' . $local;
			}
		}
		return '';
	}

	/** Ids of the users whose phone (billing_phone, phone) or login is this number, however it was typed. */
	private static function users_by_phone(string $local): array {
		global $wpdb;
		$clean = 'meta_value';
		foreach ([' ', '-', '.', '(', ')', '+'] as $ch) {
			$clean = "REPLACE($clean, '" . esc_sql($ch) . "', '')";
		}
		$ids = (array) $wpdb->get_col($wpdb->prepare(
			"SELECT DISTINCT user_id FROM {$wpdb->usermeta}
			 WHERE meta_key IN ('billing_phone', 'phone') AND meta_value <> '' AND $clean LIKE %s LIMIT 5",
			'%' . $wpdb->esc_like($local)
		));
		foreach ([$local, '225' . $local] as $login) {
			$u = get_user_by('login', $login);
			if ($u) {
				$ids[] = $u->ID;
			}
		}
		// A longer foreign number can end with the same digits: keep exact Ivorian matches only.
		$ids = array_filter(array_unique(array_map('intval', $ids)), function ($id) use ($local) {
			$u = get_userdata($id);
			if (!$u) {
				return false;
			}
			if (in_array($u->user_login, [$local, '225' . $local], true)) {
				return true;
			}
			foreach (['billing_phone', 'phone'] as $key) {
				if (self::local_phone((string) get_user_meta($id, $key, true)) === $local) {
					return true;
				}
			}
			return false;
		});
		return array_values($ids);
	}

	/** The account behind "phone or e-mail", or null (unknown, or two accounts share the number). */
	private static function find_user(string $identifier): ?WP_User {
		$identifier = trim($identifier);
		if ($identifier === '') {
			return null;
		}
		if (strpos($identifier, '@') !== false) {
			$u = get_user_by('email', sanitize_email($identifier));
			return $u ?: null;
		}
		$local = self::local_phone($identifier);
		if ($local !== '') {
			$ids = self::users_by_phone($local);
			return count($ids) === 1 ? (get_userdata($ids[0]) ?: null) : null;
		}
		$u = get_user_by('login', sanitize_user($identifier, true));
		return $u ?: null;
	}

	/** Site staff never sign in through the app. */
	private static function is_staff(WP_User $u): bool {
		foreach (['manage_options', 'manage_woocommerce', 'edit_others_posts', 'edit_users'] as $cap) {
			if (user_can($u, $cap)) {
				return true;
			}
		}
		return false;
	}

	private static function account(WP_User $u): array {
		$name = trim((string) $u->display_name) ?: trim($u->first_name . ' ' . $u->last_name) ?: 'Client LOCAPPCI';
		return [
			'name'  => html_entity_decode(wp_strip_all_tags($name), ENT_QUOTES, 'UTF-8'),
			'phone' => self::app_phone($u->ID),
			'email' => $u->user_email !== '' ? $u->user_email : null,
		];
	}

	/* ---------- Sessions ---------- */

	private static function sessions(int $user_id): array {
		$all = get_user_meta($user_id, self::META, true);
		$all = is_array($all) ? $all : [];
		$now = time();
		return array_filter($all, fn($s) => is_array($s) && (int) ($s['used'] ?? 0) + self::TTL > $now);
	}

	/** A new session token "userId.secret"; only the secret's hash is stored. */
	private static function issue(int $user_id): string {
		$secret = bin2hex(random_bytes(32));
		// Keep the most recently used sessions and always the new one: the oldest phone is signed out.
		// (Newest first, so that sessions used in the same second still drop the oldest.)
		$sessions = array_reverse(self::sessions($user_id), true);
		uasort($sessions, fn($a, $b) => ($b['used'] ?? 0) <=> ($a['used'] ?? 0));
		$sessions = array_reverse(array_slice($sessions, 0, self::MAX_SESSIONS - 1, true), true);
		$sessions[hash('sha256', $secret)] = ['created' => time(), 'used' => time()];
		update_user_meta($user_id, self::META, $sessions);
		return $user_id . '.' . $secret;
	}

	/** [user, session hash] for the request's token, or [null, '']. */
	private static function session(WP_REST_Request $r): array {
		$token = trim((string) $r->get_header('x_locappci_token'));
		if (!preg_match('/^(\d{1,10})\.([a-f0-9]{64})$/', $token, $m)) {
			return [null, ''];
		}
		$user_id = (int) $m[1];
		$hash = hash('sha256', $m[2]);
		$sessions = self::sessions($user_id);
		$found = '';
		foreach (array_keys($sessions) as $known) {
			if (hash_equals((string) $known, $hash)) {
				$found = (string) $known;
			}
		}
		$user = $found !== '' ? get_userdata($user_id) : null;
		if (!$user || self::is_staff($user)) {
			return [null, ''];
		}
		// Keep the session alive, at most one write per day.
		if ((int) $sessions[$found]['used'] < time() - DAY_IN_SECONDS) {
			$sessions[$found]['used'] = time();
			update_user_meta($user_id, self::META, $sessions);
		}
		return [$user, $found];
	}

	/** The signed-in customer of this request, or null. For the other endpoints (rental requests, orders). */
	public static function current_user(WP_REST_Request $r): ?WP_User {
		return self::session($r)[0];
	}

	/* ---------- Limits ---------- */

	private static function ip(): string {
		return isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '0';
	}

	private static function bucket(string $name): string {
		return 'locappci_rl_' . substr(hash('sha256', $name . wp_salt('nonce')), 0, 40);
	}

	private static function count(string $name): int {
		return (int) get_transient(self::bucket($name));
	}

	private static function hit(string $name, int $window): void {
		set_transient(self::bucket($name), self::count($name) + 1, $window);
	}

	private static function clear(string $name): void {
		delete_transient(self::bucket($name));
	}

	private static function json(WP_REST_Request $r): array {
		$body = $r->get_json_params();
		return is_array($body) ? $body : [];
	}

	private static function ok(array $data, int $status = 200): WP_REST_Response {
		return Locappci_Errors::no_cache(new WP_REST_Response($status === 204 ? null : $data, $status));
	}

	/** A changed or reset password signs every phone out. */
	public static function forget_sessions($user): void {
		$id = is_object($user) ? (int) $user->ID : (int) $user;
		if ($id) {
			delete_user_meta($id, self::META);
		}
	}

	/* ---------- Endpoints ---------- */

	/** POST /v1/session { identifier, password } → { account, token } */
	public static function login(WP_REST_Request $r): WP_REST_Response {
		$body = self::json($r);
		$identifier = is_string($body['identifier'] ?? null) ? trim($body['identifier']) : '';
		$password = is_string($body['password'] ?? null) ? $body['password'] : '';
		if ($identifier === '' || $password === '' || strlen($identifier) > 190 || strlen($password) > 4096) {
			return Locappci_Errors::response('unauthorized', self::BAD_LOGIN);
		}
		$who = 'login:' . strtolower(self::local_phone($identifier) ?: $identifier);
		$where = 'login-ip:' . self::ip();
		if (self::count($who) >= (int) apply_filters('locappci_login_attempts', 5) || self::count($where) >= (int) apply_filters('locappci_login_attempts_ip', 30)) {
			return Locappci_Errors::response('rate_limited', self::TOO_MANY);
		}

		$user = self::find_user($identifier);
		// Same work and same answer for "no such account" and "wrong password".
		$hash = $user ? $user->user_pass : wp_hash_password('locappci-no-such-account');
		$good = wp_check_password($password, $hash, $user ? $user->ID : 0) && $user && !self::is_staff($user);
		if (!$good) {
			self::hit($who, 15 * MINUTE_IN_SECONDS);
			self::hit($where, 15 * MINUTE_IN_SECONDS);
			return Locappci_Errors::response('unauthorized', self::BAD_LOGIN);
		}
		self::clear($who);
		return self::ok(['account' => self::account($user), 'token' => self::issue($user->ID)]);
	}

	/** POST /v1/accounts { name, phone, password, email? } → { account, token } (201) */
	public static function signup(WP_REST_Request $r): WP_REST_Response {
		$body = self::json($r);
		$name = is_string($body['name'] ?? null) ? trim(wp_strip_all_tags($body['name'])) : '';
		$name = preg_replace('/\s+/u', ' ', $name);
		$local = self::local_phone(is_string($body['phone'] ?? null) ? $body['phone'] : '');
		$password = is_string($body['password'] ?? null) ? $body['password'] : '';
		$email = is_string($body['email'] ?? null) ? trim($body['email']) : '';

		$len = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);
		if ($len < 2 || $len > 80) {
			return Locappci_Errors::response('validation', 'Indiquez votre nom (2 à 80 caractères).');
		}
		if ($local === '') {
			return Locappci_Errors::response('validation', 'Numéro ivoirien à 10 chiffres, ex. 07 00 00 00 00.');
		}
		if (strlen($password) < self::MIN_PASSWORD || strlen($password) > 4096) {
			return Locappci_Errors::response('validation', 'Le mot de passe doit faire au moins 8 caractères.');
		}
		if ($email !== '' && (!is_email($email) || strlen($email) > 100)) {
			return Locappci_Errors::response('validation', 'Cette adresse e-mail n’est pas valide.');
		}

		$where = 'signup-ip:' . self::ip();
		$today = 'signup-day:' . gmdate('Y-m-d');
		if (self::count($where) >= (int) apply_filters('locappci_signups_per_hour', 5)
			|| self::count($today) >= (int) apply_filters('locappci_signups_per_day', 200)) {
			return Locappci_Errors::response('rate_limited', 'Trop de comptes créés depuis cette connexion. Réessayez plus tard.');
		}

		if (self::users_by_phone($local) || username_exists($local)) {
			return Locappci_Errors::response('validation', 'Un compte existe déjà pour ce numéro. Connectez-vous.');
		}
		if ($email !== '' && email_exists($email)) {
			return Locappci_Errors::response('validation', 'Un compte existe déjà pour cette adresse e-mail. Connectez-vous.');
		}

		$parts = explode(' ', $name, 2);
		$user_id = wp_insert_user([
			'user_login'   => $local,
			'user_pass'    => $password,
			'user_email'   => $email,
			'display_name' => $name,
			'first_name'   => $parts[0],
			'last_name'    => $parts[1] ?? '',
			'role'         => get_role('customer') ? 'customer' : 'subscriber',
		]);
		if (is_wp_error($user_id)) {
			return Locappci_Errors::response('server_error', 'Le compte n’a pas pu être créé. Réessayez dans un instant.');
		}
		update_user_meta($user_id, 'billing_phone', '+225' . $local);
		update_user_meta($user_id, 'billing_first_name', $parts[0]);
		update_user_meta($user_id, 'billing_last_name', $parts[1] ?? '');
		update_user_meta($user_id, 'billing_country', 'CI');
		update_user_meta($user_id, self::SIGNUP_META, gmdate('c'));
		self::hit($where, HOUR_IN_SECONDS);
		self::hit($today, DAY_IN_SECONDS);

		return self::ok(['account' => self::account(get_userdata($user_id)), 'token' => self::issue($user_id)], 201);
	}

	/** GET /v1/account → the signed-in account (also tells the app its session is still valid). */
	public static function me(WP_REST_Request $r): WP_REST_Response {
		$user = self::current_user($r);
		if (!$user) {
			return Locappci_Errors::response('unauthorized', 'Votre session a expiré. Reconnectez-vous.');
		}
		return self::ok(self::account($user));
	}

	/** POST /v1/session/logout → 204. Ends this phone's session only. */
	public static function logout(WP_REST_Request $r): WP_REST_Response {
		[$user, $hash] = self::session($r);
		if ($user) {
			$sessions = self::sessions($user->ID);
			unset($sessions[$hash]);
			update_user_meta($user->ID, self::META, $sessions);
		}
		return self::ok([], 204);
	}

	/** POST /v1/accounts/delete { password } → 204. Needs the session and the password again. */
	public static function delete(WP_REST_Request $r): WP_REST_Response {
		$user = self::current_user($r);
		if (!$user) {
			return Locappci_Errors::response('unauthorized', 'Votre session a expiré. Reconnectez-vous.');
		}
		$body = self::json($r);
		$password = is_string($body['password'] ?? null) ? $body['password'] : '';
		$who = 'delete:' . $user->ID;
		if (self::count($who) >= 5) {
			return Locappci_Errors::response('rate_limited', self::TOO_MANY);
		}
		if ($password === '' || !wp_check_password($password, $user->user_pass, $user->ID)) {
			self::hit($who, 15 * MINUTE_IN_SECONDS);
			return Locappci_Errors::response('unauthorized', 'Mot de passe incorrect.');
		}
		// Sellers, loueurs, agencies…: their shop and listings depend on the account. Only the team removes those.
		if (array_diff((array) $user->roles, ['customer', 'subscriber'])) {
			return Locappci_Errors::response('validation', 'Ce compte gère une boutique ou des annonces. Écrivez à LOCAPPCI pour le supprimer.');
		}
		require_once ABSPATH . 'wp-admin/includes/user.php';
		delete_user_meta($user->ID, self::META);
		if (!wp_delete_user($user->ID)) {
			return Locappci_Errors::response('server_error', 'Le compte n’a pas pu être supprimé. Réessayez dans un instant.');
		}
		return self::ok([], 204);
	}

	/** For the diagnostics page: [accounts created from the app, accounts with an open app session]. */
	public static function counts(): array {
		global $wpdb;
		return [
			(int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT user_id) FROM {$wpdb->usermeta} WHERE meta_key = %s", self::SIGNUP_META)),
			(int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT user_id) FROM {$wpdb->usermeta} WHERE meta_key = %s AND meta_value <> 'a:0:{}'", self::META)),
		];
	}
}
