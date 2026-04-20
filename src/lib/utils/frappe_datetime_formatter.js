function formatToERPDateTime(value) {
	if (!value) return null;

	const d = new Date(value);

	if (isNaN(d.getTime())) return value;

	const pad = (n) => String(n).padStart(2, '0');

	return (
		d.getFullYear() +
		'-' +
		pad(d.getMonth() + 1) +
		'-' +
		pad(d.getDate()) +
		' ' +
		pad(d.getHours()) +
		':' +
		pad(d.getMinutes()) +
		':' +
		pad(d.getSeconds())
	);
};

export default formatToERPDateTime;