import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { fixVerdictSchema } from '../src/triage/contracts.ts';
import { prContentSchema } from '../src/triage/pipeline-contracts.ts';
import {
	prContentPrompt,
	prWritingInstructions,
} from '../src/triage/prompts.ts';

describe('Oxc pull requests', () => {
	it('requests a minimal Conventional Commit pull request', () => {
		const prompt = prContentPrompt(123, 'factory/fix-123', 'main');
		expect(prompt).toContain('scoped Conventional Commit');
		expect(prompt).toContain('Closes #123');
		expect(prompt).toContain('AI-assisted');
		expect(prompt).not.toContain('## Changes');
	});
	it('loads repository guidance without imposing Astro sections', () => {
		const prompt = prWritingInstructions(123, {
			name: 'pr-writer',
			directory: '.agents/skills/pr-writer',
		});
		expect(prompt).toContain('.agents/skills/pr-writer/SKILL.md');
		expect(prompt).not.toContain('## Changes');
	});
	it('accepts a brief description through both publication paths', () => {
		const pr = {
			title: 'fix(parser): handle a trailing comma',
			body: 'Handle the comma before the closing delimiter.\n\nCloses #123\n\nAutomated Factory fix (AI-assisted).',
		};
		expect(v.parse(prContentSchema, pr)).toEqual(pr);
		expect(() =>
			v.parse(fixVerdictSchema, {
				status: 'confirmed',
				reasoning: 'The reporter confirmed the fix.',
				pr,
			}),
		).not.toThrow();
	});
	it('rejects sectioned descriptions', () => {
		expect(() =>
			v.parse(prContentSchema, {
				title: 'fix(parser): handle comma',
				body: '## Testing\n\nA test.',
			}),
		).toThrow('no headings');
	});
});
