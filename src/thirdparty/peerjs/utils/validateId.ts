// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export const validateId = (id: string): boolean => {
	// Allow empty ids
	return !id || /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.test(id);
};
