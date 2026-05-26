import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  loadSshConfigFile,
  removeSshConfigFile,
  upsertSshConfigFile,
} from '../build/services/ssh-config-store.js';

const tempRoots = [];

function makeTempConfigPath(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-mcp-config-store-'));
  tempRoots.push(root);
  return path.join(root, name);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('SSH config store', () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('upserts an object-format config without deleting sibling entries', () => {
    const configPath = makeTempConfigPath('servers.json');
    fs.writeFileSync(configPath, JSON.stringify({
      existing: {
        host: '192.0.2.10',
        port: 22,
        username: 'root',
        password: 'old-secret',
        allowedRemotePaths: ['/root'],
      },
    }, null, 2));

    const result = upsertSshConfigFile(configPath, {
      name: 'new-vps',
      host: '198.51.100.20',
      port: '2222',
      username: 'zheng',
      password: 'new-secret',
      transportMode: 'shell',
    });

    assert.strictEqual(result.format, 'object');
    assert.deepStrictEqual(Object.keys(result.configs).sort(), ['existing', 'new-vps']);
    assert.strictEqual(result.configs['new-vps'].port, 2222);
    assert.strictEqual(result.configs['new-vps'].transportMode, 'shell');

    const stored = readJson(configPath);
    assert.strictEqual(stored.existing.password, 'old-secret');
    assert.strictEqual(stored['new-vps'].username, 'zheng');
    assert.strictEqual(stored['new-vps'].password, 'new-secret');
    assert.strictEqual(stored['new-vps'].name, undefined);
  });

  it('upserts an array-format config while preserving the array format', () => {
    const configPath = makeTempConfigPath('servers.json');
    fs.writeFileSync(configPath, JSON.stringify([
      {
        name: 'existing',
        host: '192.0.2.10',
        port: 22,
        username: 'root',
        password: 'old-secret',
      },
    ], null, 2));

    const result = upsertSshConfigFile(configPath, {
      name: 'existing',
      host: '192.0.2.11',
      port: 17223,
      username: 'zheng',
      privateKey: '~/.ssh/id_ed25519',
    });

    assert.strictEqual(result.format, 'array');
    assert.strictEqual(result.configs.existing.host, '192.0.2.11');
    assert.strictEqual(result.configs.existing.port, 17223);

    const stored = readJson(configPath);
    assert.ok(Array.isArray(stored));
    assert.strictEqual(stored.length, 1);
    assert.strictEqual(stored[0].name, 'existing');
    assert.strictEqual(stored[0].username, 'zheng');
    assert.strictEqual(stored[0].privateKey, '~/.ssh/id_ed25519');
  });

  it('removes a named config and reloads the remaining configs', () => {
    const configPath = makeTempConfigPath('servers.json');
    fs.writeFileSync(configPath, JSON.stringify({
      first: {
        host: '192.0.2.10',
        port: 22,
        username: 'root',
        password: 'first-secret',
      },
      second: {
        host: '192.0.2.11',
        port: 22,
        username: 'root',
        password: 'second-secret',
      },
    }, null, 2));

    const result = removeSshConfigFile(configPath, 'first');

    assert.deepStrictEqual(Object.keys(result.configs), ['second']);
    const stored = readJson(configPath);
    assert.strictEqual(stored.first, undefined);
    assert.strictEqual(stored.second.password, 'second-secret');
  });

  it('throws a clear error when adding a new config without authentication', () => {
    const configPath = makeTempConfigPath('servers.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2));

    assert.throws(
      () => upsertSshConfigFile(configPath, {
        name: 'missing-auth',
        host: '203.0.113.10',
        port: 22,
        username: 'root',
      }),
      /password, privateKey, or agent/,
    );
  });

  it('does not write a config when command security regex validation fails', () => {
    const configPath = makeTempConfigPath('servers.json');
    fs.writeFileSync(configPath, JSON.stringify({
      existing: {
        host: '192.0.2.10',
        port: 22,
        username: 'root',
        password: 'old-secret',
      },
    }, null, 2));
    const before = fs.readFileSync(configPath, 'utf8');

    assert.throws(
      () => upsertSshConfigFile(configPath, {
        name: 'bad-regex',
        host: '203.0.113.10',
        port: 22,
        username: 'root',
        password: 'secret',
        commandWhitelist: ['[invalid'],
      }),
      /Invalid whitelist pattern/,
    );

    assert.strictEqual(fs.readFileSync(configPath, 'utf8'), before);
  });

  it('loads normalized configs from a config file', () => {
    const configPath = makeTempConfigPath('servers.json');
    fs.writeFileSync(configPath, JSON.stringify({
      dev: {
        host: '192.0.2.10',
        port: '2222',
        user: 'root',
        password: 'secret',
      },
    }, null, 2));

    const result = loadSshConfigFile(configPath);

    assert.strictEqual(result.format, 'object');
    assert.strictEqual(result.configs.dev.name, 'dev');
    assert.strictEqual(result.configs.dev.port, 2222);
    assert.strictEqual(result.configs.dev.username, 'root');
  });
});
