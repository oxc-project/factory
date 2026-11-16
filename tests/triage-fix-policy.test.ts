import { expect, it } from 'vitest';
import { fixEligibility } from '../src/triage/fix-policy.ts';

it('leaves implementation to issue assignees', () => {
	expect(fixEligibility('bug', 'high', 'open', ['maintainer']).allowed).toBe(
		false,
	);
});
it('only implements confident diagnoses of verified bugs on open issues', () => {
	for (const [verdict, confidence, state] of [
		['unclear', 'high', 'open'],
		['intended-behavior', 'high', 'open'],
		['bug', 'low', 'open'],
		['bug', null, 'open'],
		['bug', 'high', 'closed'],
	] as const)
		expect(fixEligibility(verdict, confidence, state, []).allowed).toBe(false);
	expect(fixEligibility('bug', 'medium', 'open', []).allowed).toBe(true);
	expect(fixEligibility('bug', 'high', 'open', []).allowed).toBe(true);
});
