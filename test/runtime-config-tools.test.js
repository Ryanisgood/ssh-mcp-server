import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { registerRuntimeConfigTools } from '../build/tools/runtime-config.js';
import { SSHConnectionManager } from '../build/services/ssh-connection-manager.js';

const tempRoots = [];

function makeTempConfigPath(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-mcp-runtime-tools-'));
  tempRoots.push(root);
  return path.join(root, name);
}

function createFakeServer() {
  const tools = new Map();
  return {
    tools,
    server: {
      registerTool(name, options, handler) {
        tools.set(name, { options, handler });
      },
    },
  };
}

async function callTool(tools, name, input = {}) {
  const tool = tools.get(name);
  assert.ok(tool, `tool ${name} should be registered`);
  return tool.handler(input);
}

function textOf(result) {
  return result.content.map((entry) => entry.text).join('\n');
}

describe('Runtime config tools', () => {
  afterEach(() => {
    SSHConnectionManager.getInstance().disconnect();
    SSHConnectionManager.getInstance().setConfig({});
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('upserts a server, reloads the connection manager, and redacts secrets', async () => {
    const configPath = makeTempConfigPath('servers.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
    const { server, tools } = createFakeServer();

    registerRuntimeConfigTools(server, { configFilePath: configPath });

    const result = await callTool(tools, 'upsert-server', {
      name: 'vmiss',
      host: '203.0.113.10',
      port: 17223,
      username: 'zheng',
      password: 'super-secret',
      renewalPrice: '35 CNY',
      expiresAt: '2026-10-01',
      billingCycle: 'monthly',
    });

    assert.strictEqual(result.isError, undefined);
    const managerInfo = SSHConnectionManager.getInstance().getAllServerInfos();
    assert.strictEqual(managerInfo.length, 1);
    assert.strictEqual(managerInfo[0].name, 'vmiss');
    assert.strictEqual(managerInfo[0].port, 17223);
    assert.strictEqual(managerInfo[0].renewalPrice, '35 CNY');
    assert.strictEqual(managerInfo[0].expiresAt, '2026-10-01');
    assert.strictEqual(managerInfo[0].billingCycle, 'monthly');

    const output = textOf(result);
    assert.match(output, /Runtime SSH config updated/);
    assert.match(output, /"name": "vmiss"/);
    assert.match(output, /renewalPrice=35 CNY/);
    assert.match(output, /expiresAt=2026-10-01/);
    assert.match(output, /billingCycle=monthly/);
    assert.doesNotMatch(output, /super-secret/);
    assert.match(output, /"\*\*\*"/);
  });

  it('reloads configs from disk without restarting the MCP server', async () => {
    const configPath = makeTempConfigPath('servers.json');
    fs.writeFileSync(configPath, JSON.stringify({
      first: {
        host: '192.0.2.10',
        port: 22,
        username: 'root',
        password: 'first-secret',
      },
    }, null, 2));
    const { server, tools } = createFakeServer();

    registerRuntimeConfigTools(server, { configFilePath: configPath });
    const result = await callTool(tools, 'reload-config');

    assert.strictEqual(result.isError, undefined);
    const names = SSHConnectionManager.getInstance()
      .getAllServerInfos()
      .map((serverInfo) => serverInfo.name);
    assert.deepStrictEqual(names, ['first']);
    assert.doesNotMatch(textOf(result), /first-secret/);
  });

  it('removes a server and refreshes the connection manager', async () => {
    const configPath = makeTempConfigPath('servers.json');
    fs.writeFileSync(configPath, JSON.stringify({
      removeMe: {
        host: '192.0.2.10',
        port: 22,
        username: 'root',
        password: 'remove-secret',
      },
      keepMe: {
        host: '192.0.2.11',
        port: 22,
        username: 'root',
        password: 'keep-secret',
      },
    }, null, 2));
    const { server, tools } = createFakeServer();

    registerRuntimeConfigTools(server, { configFilePath: configPath });
    const result = await callTool(tools, 'remove-server', { name: 'removeMe' });

    assert.strictEqual(result.isError, undefined);
    const names = SSHConnectionManager.getInstance()
      .getAllServerInfos()
      .map((serverInfo) => serverInfo.name);
    assert.deepStrictEqual(names, ['keepMe']);
    const stored = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(stored.removeMe, undefined);
    assert.ok(stored.keepMe);
  });

  it('returns a clear error when runtime tools are used without --config-file', async () => {
    const { server, tools } = createFakeServer();

    registerRuntimeConfigTools(server);
    const result = await callTool(tools, 'reload-config');

    assert.strictEqual(result.isError, true);
    assert.match(textOf(result), /CONFIG_FILE_REQUIRED/);
    assert.match(textOf(result), /--config-file/);
  });
});
