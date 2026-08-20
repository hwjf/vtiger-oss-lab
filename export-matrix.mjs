import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const labDirectory = dirname(fileURLToPath(import.meta.url));
const composeFile = resolve(labDirectory, 'compose.yml');
const outputFile = resolve(labDirectory, 'matrix', 'fresh-8.x.json');
const versions = [
	{ suffix: '80', version: '8.0.0', port: 8180 },
	{ suffix: '81', version: '8.1.0', port: 8181 },
	{ suffix: '82', version: '8.2.0', port: 8182 },
	{ suffix: '83', version: '8.3.0', port: 8183 },
	{ suffix: '84', version: '8.4.0', port: 8184 },
];

const operationSql = `
SELECT o.name, o.handler_path, o.handler_method, o.type, o.prelogin,
       COALESCE(p.name, ''), COALESCE(p.type, ''), COALESCE(p.sequence, '')
FROM vtiger_ws_operation o
LEFT JOIN vtiger_ws_operation_parameters p ON p.operationid = o.operationid
ORDER BY o.name, p.sequence;
`;

function composeExec(service, ...command) {
	return execFileSync('docker', ['compose', '-f', composeFile, 'exec', '-T', service, ...command], {
		encoding: 'utf8',
	}).trim();
}

function readOperations(suffix) {
	const rows = composeExec(
		`db${suffix}`,
		'mariadb',
		'--batch',
		'--skip-column-names',
		'-uvtiger',
		'-pvtiger-lab-db',
		'vtiger',
		'-e',
		operationSql,
	);
	const operations = new Map();
	for (const row of rows.split('\n')) {
		if (!row) continue;
		const [name, handlerPath, handlerMethod, method, prelogin, parameter, type, sequence] =
			row.split('\t');
		if (!operations.has(name)) {
			operations.set(name, {
				name,
				handlerPath,
				handlerMethod,
				method,
				prelogin: prelogin === '1',
				parameters: [],
			});
		}
		if (parameter) {
			operations.get(name).parameters.push({ name: parameter, type, sequence: Number(sequence) });
		}
	}
	return [...operations.values()];
}

function readSignature(suffix, path, functionName) {
	const source = composeExec(`vtiger${suffix}`, 'cat', `/var/www/html/${path}`);
	const match = new RegExp(`function\\s+${functionName}\\s*\\(([^)]*)\\)`, 'i').exec(source);
	return match?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
}

function assess(operations, signatures) {
	const byName = Object.fromEntries(operations.map((operation) => [operation.name, operation]));
	const parameterNames = (name) =>
		byName[name]?.parameters.map((parameter) => parameter.name) ?? [];
	return {
		files_retrieve:
			parameterNames('files_retrieve').join(',') === 'id' &&
			signatures.files_retrieve?.startsWith('$id,')
				? 'compatible'
				: 'registration-handler-mismatch',
		convertlead:
			parameterNames('convertlead').join(',') === 'element'
				? 'modern-element-registration'
				: 'legacy-registration',
		sync:
			parameterNames('sync').join(',') === 'modifiedTime,elementType,syncType' &&
			signatures.sync?.startsWith('$modifiedTime,')
				? 'compatible'
				: 'registration-handler-mismatch',
	};
}

async function vtigerRequest(port, method, parameters) {
	const url = new URL(`http://127.0.0.1:${port}/webservice.php`);
	const options = { method };
	if (method === 'GET') {
		for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);
	} else {
		options.headers = { 'content-type': 'application/x-www-form-urlencoded' };
		options.body = new URLSearchParams(parameters);
	}
	const response = await fetch(url, options);
	const text = await response.text();
	let body;
	try {
		body = JSON.parse(text);
	} catch {
		body = null;
	}
	return { httpStatus: response.status, body };
}

async function probe(port) {
	const challenge = await vtigerRequest(port, 'GET', {
		operation: 'getchallenge',
		username: 'admin',
	});
	const token = challenge.body?.result?.token;
	if (!token) return { login: { status: 'failed', httpStatus: challenge.httpStatus } };
	const accessKey = createHash('md5').update(`${token}vtiger-lab-access-key`).digest('hex');
	const login = await vtigerRequest(port, 'POST', {
		operation: 'login',
		username: 'admin',
		accessKey,
	});
	const sessionName = login.body?.result?.sessionName;
	if (!sessionName) return { login: { status: 'failed', httpStatus: login.httpStatus } };
	const listtypes = await vtigerRequest(port, 'GET', {
		operation: 'listtypes',
		sessionName,
	});
	const describe = await vtigerRequest(port, 'GET', {
		operation: 'describe',
		sessionName,
		elementType: 'Contacts',
	});
	const relatedtypes = await vtigerRequest(port, 'GET', {
		operation: 'relatedtypes',
		sessionName,
		elementType: 'Contacts',
	});
	const query = await vtigerRequest(port, 'GET', {
		operation: 'query',
		sessionName,
		query: 'SELECT id FROM Contacts ORDER BY id LIMIT 0, 1;',
	});
	const futureCursor = String(Math.floor(Date.now() / 1000) + 3600);
	const sync = await vtigerRequest(port, 'GET', {
		operation: 'sync',
		sessionName,
		modifiedTime: futureCursor,
		mtime: futureCursor,
		elementType: 'Contacts',
		syncType: 'user',
	});
	return {
		login: { status: 'ok' },
		listtypes: {
			status: listtypes.body?.success === true ? 'ok' : 'failed',
			httpStatus: listtypes.httpStatus,
		},
		describe: {
			status: describe.body?.success === true ? 'ok' : 'failed',
			httpStatus: describe.httpStatus,
		},
		relatedtypes: {
			status: relatedtypes.body?.success === true ? 'ok' : 'failed',
			httpStatus: relatedtypes.httpStatus,
		},
		query: {
			status: query.body?.success === true ? 'ok' : 'failed',
			httpStatus: query.httpStatus,
		},
		sync: {
			status: sync.body?.success === true ? 'ok' : 'failed',
			httpStatus: sync.httpStatus,
			errorCode: sync.body?.error?.code,
		},
	};
}

const matrix = { generatedAt: new Date().toISOString(), installations: [] };
for (const entry of versions) {
	const operations = readOperations(entry.suffix);
	const signatures = {
		files_retrieve: readSignature(
			entry.suffix,
			'include/Webservices/FileRetrieve.php',
			'vtws_file_retrieve',
		),
		convertlead: readSignature(
			entry.suffix,
			'include/Webservices/ConvertLead.php',
			'vtws_convertlead',
		),
		sync: readSignature(entry.suffix, 'include/Webservices/GetUpdates.php', 'vtws_sync'),
	};
	matrix.installations.push({
		version: entry.version,
		kind: 'fresh',
		url: `http://localhost:${entry.port}`,
		operations,
		handlerSignatures: signatures,
		assessment: assess(operations, signatures),
		probe: await probe(entry.port),
	});
}

matrix.differences = matrix.installations.slice(1).map((current, index) => {
	const previous = matrix.installations[index];
	const previousOperations = new Map(
		previous.operations.map((operation) => [operation.name, JSON.stringify(operation)]),
	);
	const currentOperations = new Map(
		current.operations.map((operation) => [operation.name, JSON.stringify(operation)]),
	);
	return {
		from: previous.version,
		to: current.version,
		addedOperations: [...currentOperations.keys()].filter((name) => !previousOperations.has(name)),
		removedOperations: [...previousOperations.keys()].filter(
			(name) => !currentOperations.has(name),
		),
		changedOperations: [...currentOperations.keys()].filter(
			(name) =>
				previousOperations.has(name) &&
				previousOperations.get(name) !== currentOperations.get(name),
		),
		changedHandlerSignatures: Object.keys(current.handlerSignatures).filter(
			(name) => current.handlerSignatures[name] !== previous.handlerSignatures[name],
		),
	};
});

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(matrix, null, 2)}\n`);
console.log(`Wrote ${outputFile}`);
