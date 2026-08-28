/* =====================================================
   THEME TOGGLE
   ===================================================== */

const THEME_STORAGE_KEY = 'glyphengenerator-theme';
const VALID_THEMES = new Set(['light', 'dark']);

export function initTheme() {
	const html = document.documentElement;
	const themeToggle = document.getElementById('themeToggle');
	const iconSun = document.getElementById('iconSun');
	const iconMoon = document.getElementById('iconMoon');

	if (!themeToggle || !iconSun || !iconMoon) return;

	function applyTheme(theme, persist = true) {
		const nextTheme = VALID_THEMES.has(theme) ? theme : 'light';

		html.setAttribute('data-theme', nextTheme);

		if (persist) {
			try {
				localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
			} catch (error) {
				// localStorage kann z. B. im privaten Modus deaktiviert sein.
			}
		}

		themeToggle.setAttribute(
			'aria-label',
			nextTheme === 'dark' ? 'Zu Light Mode wechseln' : 'Zu Dark Mode wechseln',
		);

		themeToggle.setAttribute('aria-pressed', String(nextTheme === 'dark'));

		iconSun.style.display = nextTheme === 'dark' ? 'block' : 'none';

		iconMoon.style.display = nextTheme === 'dark' ? 'none' : 'block';
	}

	// Gespeichertes Theme laden
	let savedTheme = null;

	try {
		savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
	} catch (error) {
		// Falls localStorage nicht verfügbar ist.
	}

	// Priorität:
	// 1. gespeichertes Theme
	// 2. aktuell gesetztes data-theme im HTML
	// 3. Light Mode als Fallback
	if (VALID_THEMES.has(savedTheme)) {
		applyTheme(savedTheme, false);
	} else {
		applyTheme(html.getAttribute('data-theme'), false);
	}

	// Theme beim Klick umschalten und speichern
	themeToggle.addEventListener('click', () => {
		const currentTheme = html.getAttribute('data-theme');

		applyTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
	});
}
