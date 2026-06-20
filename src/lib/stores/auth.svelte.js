export const auth = $state({
	user: null,        // null = not yet checked, string username when logged in
	isLoading: true,   // true while checking session on mount
	boards: [],        // list of planning boards from API
	selectedBoard: null // { name, company, operation_type, abbr }
});
