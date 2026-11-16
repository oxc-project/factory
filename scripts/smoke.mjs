import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

// Exercise the built Worker without starting containers or using credentials.
const configPath = 'dist/oxc_factory/wrangler.smoke.json';
const config = JSON.parse(
	await readFile('dist/oxc_factory/wrangler.json', 'utf8'),
);
config.containers = [];
await writeFile(configPath, JSON.stringify(config));
const secret = 'factory-local-smoke-test';
const child = spawn(
	process.execPath,
	[
		'node_modules/wrangler/bin/wrangler.js',
		'dev',
		'--local',
		'--config',
		configPath,
		'--port',
		'8898',
		'--inspector-port',
		'0',
	],
	{
		env: {
			...process.env,
			GITHUB_APP_ID: 'local-test',
			GITHUB_APP_PRIVATE_KEY: 'local-test',
			GITHUB_WEBHOOK_SECRET: secret,
			FACTORY_AI_GATEWAY_ACCOUNT_ID: 'local-test',
			FACTORY_AI_GATEWAY_ID: 'local-test',
			FACTORY_AI_GATEWAY_TOKEN: 'local-test',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	},
);
let output = '';
for (const stream of [child.stdout, child.stderr]) {
	stream.on('data', (data) => {
		output = (output + data).slice(-12000);
	});
}
const exited = new Promise((resolve) => child.once('exit', resolve));
const origin = 'http://127.0.0.1:8898';
try {
	let healthy = false;
	for (let attempt = 0; attempt < 60; attempt++) {
		if (child.exitCode !== null)
			throw new Error('Local Worker exited before becoming healthy.');
		try {
			const response = await fetch(`${origin}/health`, {
				signal: AbortSignal.timeout(1000),
			});
			healthy =
				response.status === 200 && (await response.json()).status === 'ok';
		} catch {
			/* Wait for the local runtime to start. */
		}
		if (healthy) break;
		await delay(500);
	}
	if (!healthy) throw new Error('Local Worker did not become healthy.');
	const body = JSON.stringify({
		repository: { full_name: 'unrelated/repository' },
	});
	async function webhook(event, signingSecret) {
		const headers = {
			'content-type': 'application/json',
			'x-github-event': event,
			'x-github-delivery': 'local-smoke-test',
		};
		if (signingSecret)
			headers['x-hub-signature-256'] =
				`sha256=${createHmac('sha256', signingSecret).update(body).digest('hex')}`;
		return fetch(`${origin}/channels/github/webhook`, {
			method: 'POST',
			signal: AbortSignal.timeout(5000),
			headers,
			body,
		});
	}
	if ((await webhook('issues')).status !== 401)
		throw new Error('Unsigned webhook was accepted.');
	if ((await webhook('issues', 'wrong-secret')).status !== 401)
		throw new Error('Invalid signature was accepted.');
	if ((await webhook('ping', secret)).status !== 200)
		throw new Error('Signed ping was rejected.');
	const scoped = await webhook('issues', secret);
	if (scoped.status !== 200 || (await scoped.json()).accepted !== false)
		throw new Error('Unrelated repository was accepted.');
	console.log(
		'Worker health, webhook signatures, ping, and repository scope passed.',
	);
} catch (error) {
	console.error(output);
	throw error;
} finally {
	child.kill('SIGTERM');
	await Promise.race([exited, delay(5000)]);
	if (child.exitCode === null) child.kill('SIGKILL');
	await unlink(configPath);
}
