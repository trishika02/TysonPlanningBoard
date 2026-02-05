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

export const getWorkHourData = async () => {
	let from_data = '2026-02-01';
	let to_data = '2026-03-01';
	const url = `/api/method/asl_core.asl_production.doctype.work_hour_management_tool.work_hour_management_tool.get_daily_work_hours?company=Manami%20Fashions%20Ltd&planning_board_name=Sewing%20Board-MF-020226-02882&from_date=${from_data}&to_date=${to_data}`;
	const response = await fetch(url);
	// console.log(response);

	if (!response.ok) {
		return [];
	}
	const data = await response.json();
	return data?.message;
};
