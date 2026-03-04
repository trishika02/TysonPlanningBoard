export const getFloorLineData = async () => {
	const url =
		'/api/method/asl_core.asl_production.doctype.sewing_planning_board_setup.sewing_planning_board_setup.get_floors_and_lines?planning_board_name=Sewing%20Board-MF-020226-02882';
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
	const url = `/api/method/asl_core.asl_production.doctype.work_hour_management_tool.work_hour_management_tool.get_daily_work_hours?company=Manami%20Fashions%20Ltd&planning_board_name=Sewing%20Board-MF-020226-02882&from_date=${from_data}&to_date=${to_data}`;
	const response = await fetch(url);
	// console.log(response);

	if (!response.ok) {
		return [];
	}
	const data = await response.json();
	return data?.message;
};

export const getStripsWithLearningCurve = async () => {
	const url = '/api/method/asl_core.asl_production.doctype.strip.strip.get_strips_with_learning_curve';
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
