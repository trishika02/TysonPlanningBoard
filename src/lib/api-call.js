// CSRF token storage
let csrfToken = null;

const frappeFetch = async (url, options = {}) => {
	const response = await fetch(url, {
		mode: 'same-origin',
		credentials: 'include',
		headers: {
			Accept: 'application/json',
			...(options.headers || {})
		},
		...options
	});
	return response;
};

const getCsrfToken = () => {
	// Try window.frappe first for backward compatibility
	if (window.frappe?.csrf_token) {
		return window.frappe.csrf_token;
	}
	// Otherwise return the cached token
	return csrfToken || '';
};

export const fetchAndSetCsrfToken = async () => {
	try {
		const response = await frappeFetch(
			'/api/method/asl_core.asl_production.doctype.strip.strip.get_csrf_token'
		);
		if (!response.ok) {
			console.error('Failed to fetch CSRF token');
			return false;
		}
		const data = await response.json();
		csrfToken = data?.message || '';
		// Also set it on window.frappe for consistency
		if (window.frappe) {
			window.frappe.csrf_token = csrfToken;
		}
		console.log('CSRF token fetched successfully');
		return true;
	} catch (error) {
		console.error('Error fetching CSRF token:', error);
		return false;
	}
};

export const login = async (usr, pwd) => {
	const response = await frappeFetch('/api/method/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ usr, pwd })
	});
	if (!response.ok) {
		const data = await response.json().catch(() => ({}));
		throw new Error(data?.message || 'Invalid credentials');
	}
	const data = await response.json();
	// After successful login, fetch the CSRF token
	await fetchAndSetCsrfToken();
	return data;
};

export const logout = async () => {
	await frappeFetch('/api/method/logout', { method: 'POST' });
	// Clear CSRF token on logout
	csrfToken = null;
	if (window.frappe) {
		window.frappe.csrf_token = null;
	}
};

export const getLoggedUser = async () => {
	const response = await frappeFetch('/api/method/frappe.auth.get_logged_user');
	if (!response.ok) return null;
	const data = await response.json();
	return data?.message || null;
};

export const getPlanningBoards = async () => {
	const response = await frappeFetch(
		'/api/method/asl_core.api.external.planning_board.get_planning_boards'
	);
	if (!response.ok) return [];
	const data = await response.json();
	return data?.message || [];
};

export const getFloorLineData = async (planningBoard) => {
	const board = encodeURIComponent(planningBoard || 'Sewing Board-MF-020226-02882');
	const url = `/api/method/asl_core.asl_production.doctype.sewing_planning_board_setup.sewing_planning_board_setup.get_floors_and_lines?planning_board_name=${board}`;
	const response = await frappeFetch(url);
	if (!response.ok) return [];
	const data = await response.json();
	console.log('floor line data', data);
	return data?.message;
};

export const getWorkHourData = async (fromDate, toDate, planningBoard) => {
	const from_data = fromDate || '2026-02-01';
	const to_data = toDate || '2026-03-01';
	const board = encodeURIComponent(planningBoard || 'Sewing Board-MF-020226-02882');
	const url = `/api/method/asl_core.asl_production.doctype.work_hour_management_tool.work_hour_management_tool.get_daily_work_hours?company=M.I.M%20Fashion%20Wear%20Ltd.&planning_board_name=${board}&from_date=${from_data}&to_date=${to_data}`;
	const response = await frappeFetch(url);
	if (!response.ok) return [];
	const data = await response.json();
	console.log('work hour data', data);
	return data?.message;
};

export const getStripsWithLearningCurve = async (planningBoard) => {
	const board = encodeURIComponent(planningBoard || 'Sewing Board-MF-020226-02882');
	const url =
		`/api/method/asl_core.asl_production.doctype.strip.strip.get_strips_with_learning_curve?planning_board_name=${board}`;
	try {
		const response = await frappeFetch(url);
		if (!response.ok) {
			console.error('Failed to fetch strips data:', response.statusText);
			return [];
		}
		const data = await response.json();
		console.log('strips data', data);
		return data?.message || [];
	} catch (error) {
		console.error('Error fetching strips data:', error);
		return [];
	}
};

export const getShiftDetails = async () => {
	const url = '/api/method/asl_core.api.external.shift.get_shift_details';
	try {
		const response = await frappeFetch(url);
		if (!response.ok) {
			console.error('Failed to fetch shift details:', response.statusText);
			return [];
		}
		const data = await response.json();
		console.log('shift details', data);
		return data?.message || [];
	} catch (error) {
		console.error('Error fetching shift details:', error);
		return [];
	}
};

const postWithCsrf = async (url, body) => {
	const response = await frappeFetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Frappe-CSRF-Token': getCsrfToken()
		},
		body: JSON.stringify(body)
	});
	return response;
};

export const updateStripsFromTyson = async (stripsData) => {
	const url = '/api/method/asl_core.asl_production.doctype.strip.strip.update_strips_from_tyson';
	try {
		const response = await postWithCsrf(url, { data: JSON.stringify(stripsData) });
		if (!response.ok) {
			console.error('Failed to update strips:', response.statusText);
			return { success: false, error: response.statusText };
		}
		const result = await response.json();
		return result?.message || { status: 'success', message: 'Strips updated successfully' };
	} catch (error) {
		console.error('Error updating strips:', error);
		return { success: false, error: error.message };
	}
};

export const saveTysonChanges = async (changes) => {
	const url = '/api/method/asl_core.asl_production.doctype.strip.strip.save_tyson_changes';
	try {
		const response = await postWithCsrf(url, { data: JSON.stringify(changes) });
		if (!response.ok) {
			const text = await response.text();
			console.error('Failed to save changes:', response.statusText, text);
			return { success: false, error: response.statusText || text };
		}
		const result = await response.json();
		return result?.message || { status: 'success', message: 'Changes saved successfully' };
	} catch (error) {
		console.error('Error saving changes:', error);
		return { success: false, error: error.message };
	}
};
