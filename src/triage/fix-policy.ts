/** Oxc leaves implementation to assignees and only fixes verified bugs. */
export function fixEligibility(
	verdict: string,
	confidence: string | null,
	state: string,
	assignees: readonly string[],
): { allowed: true } | { allowed: false; reason: string } {
	if (state !== 'open')
		return { allowed: false, reason: 'the issue is closed' };
	if (assignees.length > 0)
		return {
			allowed: false,
			reason: 'implementation is left to the assignees',
		};
	if (verdict !== 'bug' || (confidence !== 'medium' && confidence !== 'high')) {
		return {
			allowed: false,
			reason: 'a verified bug and a confident diagnosis are required',
		};
	}
	return { allowed: true };
}
