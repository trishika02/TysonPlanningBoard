export const getFloorLineData = async () => {
	const url =
		'/api/method/asl_core.asl_production.doctype.sewing_planning_board_setup.sewing_planning_board_setup.get_floors_and_lines?planning_board_name=Sewing%20Board-MFL-020426-07088';
	const response = await fetch(url);
	if (!response.ok) {
		return [];
	}
	const data = await response.json();
	return data?.message;
};

export const getWorkHourData = async (fromDate, toDate) => {

	let from_data = fromDate || '2026-02-01';
	let to_data = toDate || '2026-03-01';
	const url = `/api/method/asl_core.asl_production.doctype.work_hour_management_tool.work_hour_management_tool.get_daily_work_hours?company=M.I.M%20Fashion%20Wear%20Ltd.&planning_board_name=Sewing%20Board-MFL-020426-07088&from_date=${from_data}&to_date=${to_data}`;
	const response = await fetch(url);
	// console.log(response);

	if (!response.ok) {
		return [];
	}
	const data = await response.json();
	return data?.message;
};

export const getStripsWithLearningCurve = async () => {
	const url = '/api/method/asl_core.asl_production.doctype.strip.strip.get_strips_with_learning_curve?planning_board_name=Sewing%20Board-MFL-020426-07088';
	try {
		const response = await fetch(url);
		if (!response.ok) {
			console.error('Failed to fetch strips data:', response.statusText);
			return [];
		}
		const data = await response.json();
		return data?.message || [];
	} catch (error) {
		console.error('Error fetching strips data:', error);
		return [];
	}
};

export const getShiftDetails = async () => {
	const url = '/api/method/asl_core.api.external.shift.get_shift_details';
	try {
		const response = await fetch(url);
		if (!response.ok) {
			console.error('Failed to fetch shift details:', response.statusText);
			return [];
		}
		const data = await response.json();
		return data?.message || [];
	} catch (error) {
		console.error('Error fetching shift details:', error);
		return [];
	}
};

export const updateStripsFromTyson = async (stripsData) => {
	const url = '/api/method/asl_core.asl_production.doctype.strip.strip.update_strips_from_tyson';
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ data: JSON.stringify(stripsData) })
		});
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
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ data: JSON.stringify(changes) })
		});
		if (!response.ok) {
			console.error('Failed to save changes:', response.statusText);
			return { success: false, error: response.statusText };
		}
		const result = await response.json();
		return result?.message || { status: 'success', message: 'Changes saved successfully' };
	} catch (error) {
		console.error('Error saving changes:', error);
		return { success: false, error: error.message };
	}
};
