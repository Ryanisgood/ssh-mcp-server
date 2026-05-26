import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const skillDir = path.join(rootDir, 'skills', 'server-init-config');
const skillPath = path.join(skillDir, 'SKILL.md');
const referencesDir = path.join(skillDir, 'references');
const scriptsDir = path.join(skillDir, 'scripts');
const commonScriptsDir = path.join(scriptsDir, 'common');
const flowScriptsDir = path.join(scriptsDir, 'flows');
const featureScriptsDir = path.join(scriptsDir, 'features');
const oldMonolithPath = path.join(skillDir, 'server-init.sh');

function assertIncludesAll(text, patterns, label) {
  for (const pattern of patterns) {
    assert.match(text, pattern, `${label} should match ${pattern}`);
  }
}

function assertMarkersInOrder(text, markers, label) {
  let previousIndex = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    assert.ok(index > -1, `${label} should include ${marker}`);
    assert.ok(index > previousIndex, `${label} should place ${marker} after the previous marker`);
    previousIndex = index;
  }
}

function assertLineMarkersInOrder(text, markers, label) {
  const lines = text.split('\n');
  let previousLine = -1;
  for (const marker of markers) {
    const line = lines.findIndex((entry, index) => index > previousLine && entry.includes(marker));
    assert.ok(line > -1, `${label} should include ${marker} after line ${previousLine + 1}`);
    previousLine = line;
  }
}

function topLevelShellCalls(text) {
  const calls = [];
  let depth = 0;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    const startsFunction = /^[A-Za-z_][A-Za-z0-9_]*\(\)\s*\{/.test(line);

    if (
      depth === 0
      && line
      && !line.startsWith('#')
      && !line.includes('=')
      && !line.startsWith('. ')
      && !line.startsWith('set ')
      && !line.startsWith('echo ')
      && !startsFunction
    ) {
      const call = line.split(/\s+/)[0];
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(call)) {
        calls.push(call);
      }
    }

    if (startsFunction || line.endsWith('{')) {
      depth += 1;
    }
    if (line === '}' || line.endsWith('}')) {
      depth = Math.max(0, depth - 1);
    }
  }

  return calls;
}

function shellFunctionBody(text, functionName) {
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`(^|\\n)${escaped}\\(\\) \\{([\\s\\S]*?)\\n\\}`, 'm'));
  assert.ok(match, `${functionName} function should exist`);
  return match[2];
}

describe('server-init-config skill', () => {
  it('uses modular references and scripts instead of one monolithic init script', () => {
    assert.ok(fs.existsSync(referencesDir), 'references directory should exist');
    assert.ok(fs.existsSync(path.join(referencesDir, 'flows')), 'flow references should exist');
    assert.ok(fs.existsSync(path.join(referencesDir, 'features')), 'feature references should exist');
    assert.ok(fs.existsSync(commonScriptsDir), 'common scripts should exist');
    assert.ok(fs.existsSync(flowScriptsDir), 'flow scripts should exist');
    assert.ok(fs.existsSync(featureScriptsDir), 'feature scripts should exist');
    assert.ok(!fs.existsSync(oldMonolithPath), 'server-init.sh monolith should be removed');
  });

  it('keeps quick path and mandatory rules before detailed references', () => {
    const text = fs.readFileSync(skillPath, 'utf8');

    assertMarkersInOrder(text, ['## Quick Path', '## Mandatory Rules', '## References'], 'SKILL.md');
    assert.match(text, /references\/task-tracking\.md/);
    assert.ok(text.indexOf('Task Tracking Template') === -1, 'long task tracking table should move out of SKILL.md');
    assert.ok(text.indexOf('Evidence to Record') === -1, 'task tracking evidence column should move out of SKILL.md');
    assert.ok(text.indexOf('Stop Condition') === -1, 'task tracking stop condition column should move out of SKILL.md');
  });

  it('probes OS and memory before asking branch-specific policy questions', () => {
    const skillText = fs.readFileSync(skillPath, 'utf8');
    const quickPathText = fs.readFileSync(path.join(referencesDir, 'quick-path.md'), 'utf8');
    const policyText = fs.readFileSync(path.join(referencesDir, 'policy-questions.md'), 'utf8');

    assertMarkersInOrder(
      skillText,
      [
        'Run `list-servers`',
        'If the target is missing and the user already provided host, port, username, password, and name',
        'Probe OS and actual usable memory',
        'Pick exactly one OS flow',
        'Ask branch-specific policy questions',
      ],
      'SKILL.md',
    );
    assertMarkersInOrder(
      quickPathText,
      [
        'Confirm the target MCP entry',
        'Create or update the bootstrap MCP entry yourself',
        'Probe OS and actual usable memory',
        'Select one OS flow',
        'Ask branch-specific policy questions',
      ],
      'quick-path.md',
    );
    assert.match(policyText, /Do not ask policy questions until OS and effective memory are known/);
  });

  it('requires the agent to create bootstrap MCP config from provided connection details', () => {
    const skillText = fs.readFileSync(skillPath, 'utf8');
    const quickPathText = fs.readFileSync(path.join(referencesDir, 'quick-path.md'), 'utf8');
    const taskText = fs.readFileSync(path.join(referencesDir, 'task-tracking.md'), 'utf8');
    const bootstrapPath = path.join(referencesDir, 'bootstrap-mcp-config.md');

    assert.ok(fs.existsSync(bootstrapPath), 'bootstrap-mcp-config.md should exist');
    const bootstrapText = fs.readFileSync(bootstrapPath, 'utf8');

    assert.match(skillText, /references\/bootstrap-mcp-config\.md/);
    assert.match(skillText, /不要要求用户手工加入 MCP 配置/);
    assert.match(skillText, /host, port, username, password, and name/);
    assert.match(quickPathText, /Create or update the bootstrap MCP entry yourself/);
    assert.match(taskText, /Create bootstrap MCP entry/);

    assert.match(bootstrapText, /# Bootstrap MCP Config/);
    assert.match(bootstrapText, /用户已经提供/);
    assert.match(bootstrapText, /\/Users\/zheng\/\.ssh-mcp-config\.json/);
    assert.match(bootstrapText, /upsert/i);
    assert.match(bootstrapText, /list-servers/);
    assert.match(bootstrapText, /不要要求用户手工加入 MCP 配置/);
    assert.match(bootstrapText, /restart|重启|reload|重载/i);
    assert.match(bootstrapText, /"name": "连接名称"/);
    assert.match(bootstrapText, /"host": "203\.0\.113\.10"/);
    assert.match(bootstrapText, /"port": 22/);
    assert.match(bootstrapText, /"username": "root"/);
    assert.doesNotMatch(bootstrapText, /SERct|38\.95\.76\.93|美国vmiss/);
  });

  it('uses one top-level probe script while keeping OS and memory probes reusable', () => {
    const skillText = fs.readFileSync(skillPath, 'utf8');
    const quickPathText = fs.readFileSync(path.join(referencesDir, 'quick-path.md'), 'utf8');
    const probePath = path.join(commonScriptsDir, 'probe.sh');

    assert.match(skillText, /scripts\/common\/probe\.sh/);
    assert.match(quickPathText, /scripts\/common\/probe\.sh/);
    assert.doesNotMatch(quickPathText, /Probe OS by uploading and running `scripts\/common\/detect\.sh`/);
    assert.doesNotMatch(quickPathText, /Probe actual usable memory by uploading and running `scripts\/common\/memory\.sh`/);

    assert.ok(fs.existsSync(probePath), 'common/probe.sh should exist');
    const probeText = fs.readFileSync(probePath, 'utf8');
    assertLineMarkersInOrder(probeText, ['detect.sh', 'memory.sh'], 'probe.sh');
  });

  it('provides focused reference documents for flows and features', () => {
    const requiredReferences = [
      { file: 'quick-path.md', patterns: [/^# Quick Path/m, /list-servers/, /effective_memory_mb/, /Select one OS flow/i] },
      { file: 'bootstrap-mcp-config.md', patterns: [/^# Bootstrap MCP Config/m, /\/Users\/zheng\/\.ssh-mcp-config\.json/, /upsert/i, /list-servers/] },
      { file: 'policy-questions.md', patterns: [/^# Policy Questions/m, /所有|中文|branch-specific|分支/, /VLESS 默认配置/, /HY2 自定义端口/, /REALITY_DEST_PORT/] },
      { file: 'memory-detection.md', patterns: [/^# Memory Detection/m, /实际可用内存/, /不能只读取 `\/proc\/meminfo`/, /cgroup v2/, /OpenVZ/, /effective_memory_mb/] },
      { file: 'task-tracking.md', patterns: [/^# Task Tracking/m, /pending/, /in_progress/, /completed/, /Success Check/, /Stop Condition/] },
      { file: 'mcp-handoff.md', patterns: [/^# MCP Handoff/m, /parallel temporary MCP entry/, /whoami/, /sudo -S/, /FINALIZE_SSH_LOCKDOWN=1/] },
      { file: 'failure-handling.md', patterns: [/^# Failure Handling/m, /Stop at the first failed safety check/, /do not run SSH lockdown/i, /do not remove remote deployment scripts/i] },
      { file: 'flows/alpine-low-memory.md', patterns: [/^# Alpine Low Memory Flow/m, /小内存 Alpine 默认流程仅且仅有三步/, /scripts\/flows\/alpine-low-memory\.sh/, /Forbidden by default/] },
      { file: 'flows/alpine-standard.md', patterns: [/^# Alpine Standard Flow/m, /effective_memory_mb >= 256/, /apk/, /OpenRC/] },
      { file: 'flows/debian-standard.md', patterns: [/^# Debian Standard Flow/m, /Debian or Ubuntu/, /apt-get update/, /Normal ordering/] },
      { file: 'flows/root-password.md', patterns: [/^# Root Password Flow/m, /root \+ password/, /Do not create `zheng`/, /change_password: false/] },
      { file: 'flows/zheng-key-lockdown.md', patterns: [/^# zheng Key Lockdown Flow/m, /ssh-prepare\.sh/, /ssh-lockdown\.sh/, /FINALIZE_SSH_LOCKDOWN=1/, /212243/] },
      { file: 'features/backup.md', patterns: [/^# Backup/m, /scripts\/features\/backup\.sh/, /enabled backup/i] },
      { file: 'features/bbr.md', patterns: [/^# BBR/m, /BBRv3/i, /scripts\/features\/bbr\.sh/, /before proxy installation/i, /low-memory Alpine/i] },
      { file: 'features/fail2ban.md', patterns: [/^# Fail2ban/m, /scripts\/features\/fail2ban\.sh/, /low-memory Alpine default flow/i] },
      { file: 'features/firewall.md', patterns: [/^# Firewall/m, /ufw/i, /scripts\/features\/firewall\.sh/, /allow current SSH port/i, /selected proxy port/i] },
      { file: 'features/proxy-hy2.md', patterns: [/^# HY2/m, /scripts\/features\/proxy-hy2\.sh/, /HY2_PORT=443/] },
      { file: 'features/proxy-vless-reality.md', patterns: [/^# VLESS Reality/m, /scripts\/features\/proxy-vless-reality\.sh/, /VLESS_PORT=443/, /REALITY_SERVER_NAME/] },
    ];

    for (const { file, patterns } of requiredReferences) {
      const fullPath = path.join(referencesDir, file);
      assert.ok(fs.existsSync(fullPath), `${file} should exist`);
      assertIncludesAll(fs.readFileSync(fullPath, 'utf8'), patterns, file);
    }
  });

  it('provides syntax-valid POSIX shell scripts by responsibility', () => {
    const requiredScripts = [
      { file: 'common/detect.sh', patterns: [/os_id/, /os_family/, /pkg_manager/, /service_manager/] },
      { file: 'common/memory.sh', patterns: [/effective_memory_mb/, /\/sys\/fs\/cgroup\/memory\.max/, /\/sys\/fs\/cgroup\/memory\/memory\.limit_in_bytes/, /\/proc\/user_beancounters/] },
      { file: 'common/probe.sh', patterns: [/detect\.sh/, /memory\.sh/, /os_id=/, /effective_memory_mb=/] },
      { file: 'common/packages.sh', patterns: [/apt_update\(\)/, /apt_install_required\(\)/, /apk_update\(\)/, /apk_install_required\(\)/] },
      { file: 'common/services.sh', patterns: [/service_restart\(\)/, /service_enable_now\(\)/, /ssh_service_name\(\)/] },
      { file: 'common/verify.sh', patterns: [/whoami=/, /sshd_/, /sshd -T/] },
      { file: 'flows/alpine-low-memory.sh', patterns: [/require_root/, /alpine_update\(\)/, /alpine_required_tools\(\)/, /apk_update/, /apk_install_proxy_tools/, /next=selected-proxy-only/] },
      { file: 'flows/alpine-standard.sh', patterns: [/require_root/, /apk_update/, /apk_install_required/, /flow=alpine-standard/, /next=selected-features/] },
      { file: 'flows/debian-standard.sh', patterns: [/require_root/, /apt_update/, /apt_install_required/, /flow=debian-standard/, /next=selected-features/] },
      { file: 'features/backup.sh', patterns: [/server-init-backup/, /\/etc\/ssh/, /tar -czf/, /backup=/] },
      { file: 'features/bbr.sh', patterns: [/BBRv3/i, /net\.core\.default_qdisc=fq/, /net\.ipv4\.tcp_congestion_control=bbr/, /bbr_congestion_control=/] },
      { file: 'features/cleanup.sh', patterns: [/rm\s+-rf/, /server-init/, /cleanup=/] },
      { file: 'features/fail2ban.sh', patterns: [/fail2ban/, /jail\.local/, /service_enable_now fail2ban/, /fail2ban=active|fail2ban=inactive/] },
      { file: 'features/firewall.sh', patterns: [/ufw/, /FIREWALL_SSH_PORT/, /PROXY_PORT/, /allow current SSH port/i, /selected proxy port/i, /firewall=active|firewall=inactive/] },
      { file: 'features/proxy-hy2.sh', patterns: [/HY2_PORT/, /hysteria|hy2/i, /proxy_hy2|hy2=/i] },
      { file: 'features/proxy-vless-reality.sh', patterns: [/VLESS_PORT/, /REALITY_SERVER_NAME/, /REALITY_DEST_PORT/, /xray|VLESS/i] },
      { file: 'features/ssh-lockdown.sh', patterns: [/FINALIZE_SSH_LOCKDOWN/, /PermitRootLogin no/, /PasswordAuthentication no/, /service_restart/] },
      { file: 'features/ssh-prepare.sh', patterns: [/NEW_USER/, /SSH_PORT/, /17223/, /authorized_keys/, /root_password_still_enabled=yes/] },
    ];

    for (const { file, patterns } of requiredScripts) {
      const fullPath = path.join(scriptsDir, file);
      assert.ok(fs.existsSync(fullPath), `${file} should exist`);
      execFileSync('sh', ['-n', fullPath], { cwd: rootDir });
      assertIncludesAll(fs.readFileSync(fullPath, 'utf8'), patterns, file);
    }
  });

  it('documents required pre-run choices and login policies', () => {
    const text = fs.readFileSync(skillPath, 'utf8');

    assert.match(text, /Alpine/i);
    assert.match(text, /256MB/);
    assert.match(text, /root\s*\+\s*password/i);
    assert.match(text, /zheng/i);
    assert.match(text, /VLESS\s*\+\s*Reality/i);
    assert.match(text, /HY2/i);
    assert.match(text, /backup/i);
    assert.match(text, /fail2ban/i);
  });

  it('requires confirmation for low-memory Alpine defaults and detailed proxy choices', () => {
    const skillText = fs.readFileSync(skillPath, 'utf8');
    const policyText = fs.readFileSync(path.join(referencesDir, 'policy-questions.md'), 'utf8');

    assert.match(skillText, /Alpine[^\n]{0,120}<256MB[^\n]{0,160}(询问|中文)/);
    assert.match(skillText, /默认初始化流程/);
    assert.match(policyText, /Low-memory Alpine questions/);
    assert.match(policyText, /仅更新系统、安装必要工具、安装代理/);
    assert.match(policyText, /Standard flow questions/);
    assert.match(policyText, /VLESS 默认配置/);
    assert.match(policyText, /HY2 默认配置/);
    assert.match(policyText, /VLESS 自定义端口/);
    assert.match(policyText, /HY2 自定义端口/);
    assert.match(policyText, /REALITY_SERVER_NAME/);
    assert.match(policyText, /REALITY_DEST_PORT/);
    assert.match(policyText, /VLESS_PORT/);
    assert.match(policyText, /HY2_PORT/);
  });

  it('keeps low-memory Alpine flow limited to update, tools, and proxy handoff', () => {
    const referenceText = fs.readFileSync(path.join(referencesDir, 'flows', 'alpine-low-memory.md'), 'utf8');
    const flowText = fs.readFileSync(path.join(flowScriptsDir, 'alpine-low-memory.sh'), 'utf8');
    const packagesText = fs.readFileSync(path.join(commonScriptsDir, 'packages.sh'), 'utf8');
    const proxyToolsBody = shellFunctionBody(packagesText, 'apk_install_proxy_tools');

    assert.match(referenceText, /小内存 Alpine 默认流程仅且仅有三步/);
    assert.match(referenceText, /更新系统、安装必要工具、安装代理/);
    assert.deepStrictEqual(topLevelShellCalls(flowText), ['require_root', 'alpine_update', 'alpine_required_tools']);
    assert.match(flowText, /alpine_update/);
    assert.match(flowText, /apk_install_proxy_tools/);
    assertIncludesAll(proxyToolsBody, [/curl/, /openssl/, /bash/, /ca-certificates/], 'apk_install_proxy_tools');
    assert.doesNotMatch(proxyToolsBody, /git|htop|tmux|bind-tools|jq|unzip|rsync|openssh-server|iptables|ip6tables|shadow|tar|gzip/);
  });

  it('keeps Debian and Alpine flows separated by package manager', () => {
    const debianFlowText = fs.readFileSync(path.join(flowScriptsDir, 'debian-standard.sh'), 'utf8');
    const alpineFlowText = fs.readFileSync(path.join(flowScriptsDir, 'alpine-standard.sh'), 'utf8');
    const alpineLowMemoryText = fs.readFileSync(path.join(flowScriptsDir, 'alpine-low-memory.sh'), 'utf8');

    assert.match(debianFlowText, /apt_update/);
    assert.match(debianFlowText, /apt_install_required/);
    assert.doesNotMatch(debianFlowText, /apk_update|apk_install_required|apk add/);

    assert.match(alpineFlowText, /apk_update/);
    assert.match(alpineFlowText, /apk_install_required/);
    assert.doesNotMatch(alpineFlowText, /apt_update|apt_install_required|apt-get/);

    assert.match(alpineLowMemoryText, /apk_update/);
    assert.match(alpineLowMemoryText, /apk_install_proxy_tools/);
    assert.doesNotMatch(alpineLowMemoryText, /apt_update|apt_install_required|apt-get/);
  });

  it('bounds OS package manager calls where scripts perform network package work', () => {
    const packagesText = fs.readFileSync(path.join(commonScriptsDir, 'packages.sh'), 'utf8');
    const fail2banText = fs.readFileSync(path.join(featureScriptsDir, 'fail2ban.sh'), 'utf8');

    assert.match(packagesText, /run_with_timeout\(\)/);
    assert.match(packagesText, /run_with_timeout 300 apt-get update/);
    assert.match(packagesText, /run_with_timeout 600 apt-get upgrade/);
    assert.match(packagesText, /run_with_timeout 300 apt-get install/);
    assert.match(packagesText, /run_with_timeout 300 apk update/);
    assert.match(packagesText, /run_with_timeout 600 apk upgrade/);
    assert.match(packagesText, /run_with_timeout 300 apk add/);

    assert.match(fail2banText, /run_with_timeout\(\)/);
    assert.match(fail2banText, /run_with_timeout 300 apt-get update/);
    assert.match(fail2banText, /run_with_timeout 300 apt-get install/);
    assert.match(fail2banText, /run_with_timeout 300 apk add/);
  });

  it('keeps timeout wrappers cleanup-safe under set -e', () => {
    const files = [
      path.join(commonScriptsDir, 'packages.sh'),
      path.join(commonScriptsDir, 'services.sh'),
      path.join(featureScriptsDir, 'fail2ban.sh'),
      path.join(featureScriptsDir, 'proxy-hy2.sh'),
      path.join(featureScriptsDir, 'proxy-vless-reality.sh'),
    ];

    for (const fullPath of files) {
      const text = fs.readFileSync(fullPath, 'utf8');
      assertLineMarkersInOrder(
        text,
        ['run_with_timeout()', 'set +e', 'wait "$pid"', 'status="$?"', 'set -e', 'kill "$watcher"'],
        path.basename(fullPath),
      );
    }
  });

  it('bounds service manager operations', () => {
    const servicesText = fs.readFileSync(path.join(commonScriptsDir, 'services.sh'), 'utf8');

    assert.match(servicesText, /run_with_timeout\(\)/);
    assert.match(servicesText, /run_with_timeout 60 systemctl restart/);
    assert.match(servicesText, /run_with_timeout 60 systemctl enable --now/);
    assert.match(servicesText, /run_with_timeout 60 rc-update add/);
    assert.match(servicesText, /run_with_timeout 60 rc-service/);
  });

  it('keeps proxy scripts independent from SSH hardening', () => {
    for (const file of ['proxy-vless-reality.sh', 'proxy-hy2.sh']) {
      const scriptText = fs.readFileSync(path.join(featureScriptsDir, file), 'utf8');

      assert.doesNotMatch(scriptText, /PermitRootLogin|PasswordAuthentication|KbdInteractiveAuthentication/);
      assert.doesNotMatch(scriptText, /sshd_config|ssh-lockdown|ssh-prepare|FINALIZE_SSH_LOCKDOWN/);
      assert.doesNotMatch(scriptText, /authorized_keys|NEW_USER|sudoers/);
    }
  });

  it('uses ufw as the only firewall hardening backend', () => {
    const firewallReferenceText = fs.readFileSync(path.join(referencesDir, 'features', 'firewall.md'), 'utf8');
    const firewallScriptText = fs.readFileSync(path.join(featureScriptsDir, 'firewall.sh'), 'utf8');

    assert.match(firewallReferenceText, /Use `ufw`/);
    assert.match(firewallReferenceText, /must be explicitly provided/);
    assert.match(firewallScriptText, /error=missing_firewall_ssh_port/);
    assert.doesNotMatch(firewallScriptText, /FIREWALL_SSH_PORT="\$\{FIREWALL_SSH_PORT:-22\}"/);
    assert.match(firewallScriptText, /ufw default deny incoming/);
    assert.match(firewallScriptText, /ufw default allow outgoing/);
    assert.doesNotMatch(firewallReferenceText, /iptables|nftables/);
    assert.doesNotMatch(firewallScriptText, /iptables|nft/);
  });

  it('bounds proxy package installation and downloads', () => {
    for (const file of ['proxy-vless-reality.sh', 'proxy-hy2.sh']) {
      const scriptText = fs.readFileSync(path.join(featureScriptsDir, file), 'utf8');

      assert.match(scriptText, /run_with_timeout\(\)/, `${file} should define a timeout wrapper`);
      assert.match(scriptText, /run_with_timeout 180 apt-get/, `${file} should bound apt package installation`);
      assert.match(scriptText, /run_with_timeout 180 apk/, `${file} should bound apk package installation`);
      assert.match(scriptText, /curl[^\n]*--connect-timeout 15[^\n]*--max-time 120/, `${file} should bound curl downloads`);
      assert.match(scriptText, /run_with_timeout 60 systemctl/, `${file} should bound systemctl service operations`);
      assert.match(scriptText, /run_with_timeout 60 rc-service/, `${file} should bound OpenRC service operations`);
    }
  });

  it('requires Reality SNI to be a domain hostname, not an IP or single label', () => {
    const scriptText = fs.readFileSync(path.join(featureScriptsDir, 'proxy-vless-reality.sh'), 'utf8');

    assert.match(scriptText, /require_domain_hostname\(\)/);
    assert.match(scriptText, /error=reality_server_name_must_be_domain/);
    assert.match(scriptText, /error=reality_server_name_must_not_be_ip/);
  });

  it('gates SSH lockdown before any sshd mutation', () => {
    const lockdownText = fs.readFileSync(path.join(featureScriptsDir, 'ssh-lockdown.sh'), 'utf8');

    assert.match(lockdownText, /FINALIZE_SSH_LOCKDOWN:-0/);
    assert.match(lockdownText, /error=FINALIZE_SSH_LOCKDOWN_required/);
    assert.match(lockdownText, /LOCKDOWN_CONFIRMED_USER:-zheng/);
    assert.match(lockdownText, /SUDO_USER/);
    assert.ok(
      lockdownText.indexOf('FINALIZE_SSH_LOCKDOWN:-0') < lockdownText.indexOf('set_sshd_port "$SSH_PORT"'),
      'FINALIZE_SSH_LOCKDOWN gate should run before changing sshd port',
    );
    assert.ok(
      lockdownText.indexOf('SUDO_USER') < lockdownText.indexOf('set_sshd_port "$SSH_PORT"'),
      'sudo-origin proof should run before changing sshd port',
    );
    assert.ok(
      lockdownText.indexOf('FINALIZE_SSH_LOCKDOWN:-0') < lockdownText.indexOf('PermitRootLogin no'),
      'FINALIZE_SSH_LOCKDOWN gate should run before disabling root login',
    );
  });

  it('merges SSH keys during prepare instead of replacing existing recovery keys', () => {
    const prepareText = fs.readFileSync(path.join(featureScriptsDir, 'ssh-prepare.sh'), 'utf8');

    assert.match(prepareText, /touch "\$ssh_dir\/authorized_keys"/);
    assert.match(prepareText, /grep -qxF "\$SSH_PUBLIC_KEY" "\$ssh_dir\/authorized_keys"/);
    assert.doesNotMatch(prepareText, /printf '%s\\n' "\$SSH_PUBLIC_KEY" > "\$ssh_dir\/authorized_keys"/);
  });

  it('detects effective memory from cgroup and OpenVZ limits', () => {
    const referenceText = fs.readFileSync(path.join(referencesDir, 'memory-detection.md'), 'utf8');
    const scriptText = fs.readFileSync(path.join(commonScriptsDir, 'memory.sh'), 'utf8');

    assert.match(referenceText, /实际可用内存/);
    assert.match(referenceText, /不能只读取 `\/proc\/meminfo`/);
    assert.match(referenceText, /cgroup v2/);
    assert.match(referenceText, /cgroup v1/);
    assert.match(referenceText, /OpenVZ/);
    assert.match(scriptText, /\/sys\/fs\/cgroup\/memory\.max/);
    assert.match(scriptText, /\/sys\/fs\/cgroup\/memory\/memory\.limit_in_bytes/);
    assert.match(scriptText, /\/proc\/user_beancounters/);
    assert.match(scriptText, /effective_memory_mb/);
  });

  it('requires all human-facing questions to be asked in Chinese', () => {
    const text = fs.readFileSync(skillPath, 'utf8');
    const policyText = fs.readFileSync(path.join(referencesDir, 'policy-questions.md'), 'utf8');

    assert.match(text, /所有面向用户的询问必须使用中文/);
    assert.match(text, /标准 Alpine、Debian、Ubuntu 流程/);
    assert.match(policyText, /Low-memory Alpine questions/);
    assert.match(policyText, /是否执行小内存默认初始化流程/);
    assert.match(policyText, /是否安装代理/);
    assert.match(policyText, /Standard flow questions/);
    assert.match(policyText, /是否创建 `zheng` 用户/);
    assert.match(policyText, /是否启用备份/);
    assert.match(policyText, /Only ask the fixed-password question after `login_mode: zheng_key_lockdown`/);
    assert.doesNotMatch(policyText, /是否启用 fail2ban/);
    assert.doesNotMatch(policyText, /是否启用防火墙加固/);
    assert.doesNotMatch(policyText, /是否启用 BBR/);
    assert.match(policyText, /fail2ban_enabled: true/);
    assert.match(policyText, /firewall_enabled: true/);
    assert.match(policyText, /bbr_enabled: true/);

    const lowMemorySection = policyText.slice(
      policyText.indexOf('## Low-memory Alpine questions'),
      policyText.indexOf('## Standard flow questions'),
    );
    assert.doesNotMatch(lowMemorySection, /是否创建 `zheng` 用户/);
    assert.doesNotMatch(lowMemorySection, /是否启用备份/);
    assert.doesNotMatch(lowMemorySection, /是否修改固定密码/);
    assert.doesNotMatch(lowMemorySection, /是否启用 fail2ban|是否启用防火墙加固|是否启用 BBR/);

    const initialStandardSection = policyText.slice(
      policyText.indexOf('## Standard flow questions'),
      policyText.indexOf('## zheng conditional question'),
    );
    assert.doesNotMatch(initialStandardSection, /是否修改固定密码/);
    assert.match(policyText, /If `login_mode: root_password`, record `change_password: false` without asking/);
  });

  it('blocks standard flows until every required user answer and default policy value is recorded', () => {
    const skillText = fs.readFileSync(skillPath, 'utf8');
    const quickPathText = fs.readFileSync(path.join(referencesDir, 'quick-path.md'), 'utf8');
    const policyText = fs.readFileSync(path.join(referencesDir, 'policy-questions.md'), 'utf8');
    const taskText = fs.readFileSync(path.join(referencesDir, 'task-tracking.md'), 'utf8');

    assert.match(skillText, /policy_decision_record/);
    assert.match(skillText, /POLICY_INCOMPLETE_STOP/);
    assert.match(skillText, /login_mode/);
    assert.match(skillText, /proxy_choice/);
    assert.match(skillText, /backup_enabled/);
    assert.match(skillText, /change_password/);
    assert.match(skillText, /fail2ban_enabled=true/);
    assert.match(skillText, /firewall_enabled=true/);
    assert.match(skillText, /bbr_enabled=true/);

    assertLineMarkersInOrder(
      quickPathText,
      [
        'Ask branch-specific policy questions',
        'policy_decision_record',
        'POLICY_INCOMPLETE_STOP',
        'Add only the selected login policy and feature scripts',
      ],
      'quick-path.md',
    );

    assert.match(policyText, /Missing any user-answer field means BLOCKED/);
    assert.match(policyText, /Do not infer defaults from partial user instructions/);
    assert.match(policyText, /If the user says only "no backup" and "VLESS", this is incomplete/);
    assert.match(policyText, /Do not ask the user whether to enable fail2ban, firewall hardening, or BBRv3/);

    assert.match(taskText, /policy_decision_record/);
    assert.match(taskText, /POLICY_INCOMPLETE_STOP/);
    assert.match(taskText, /firewall_enabled/);
    assert.match(taskText, /bbr_enabled/);
  });

  it('requires system update and required tools before any optional mutation', () => {
    const skillText = fs.readFileSync(skillPath, 'utf8');
    const quickPathText = fs.readFileSync(path.join(referencesDir, 'quick-path.md'), 'utf8');
    const debianFlowText = fs.readFileSync(path.join(referencesDir, 'flows', 'debian-standard.md'), 'utf8');
    const alpineFlowText = fs.readFileSync(path.join(referencesDir, 'flows', 'alpine-standard.md'), 'utf8');

    assert.match(skillText, /必须先更新系统并安装必要工具/);
    assertMarkersInOrder(quickPathText, ['Probe OS and actual usable memory', 'Select one OS flow'], 'quick-path.md');
    assertLineMarkersInOrder(debianFlowText, ['Normal ordering:', 'update', 'tools', 'optional backup', 'optional SSH prepare'], 'debian-standard.md');
    assertLineMarkersInOrder(alpineFlowText, ['Run `scripts/flows/alpine-standard.sh` first', 'update and required tools'], 'alpine-standard.md');
  });

  it('runs BBR and network tuning before proxy installation', () => {
    const skillText = fs.readFileSync(skillPath, 'utf8');
    const debianFlowText = fs.readFileSync(path.join(referencesDir, 'flows', 'debian-standard.md'), 'utf8');
    const bbrReferenceText = fs.readFileSync(path.join(referencesDir, 'features', 'bbr.md'), 'utf8');
    const bbrScriptText = fs.readFileSync(path.join(featureScriptsDir, 'bbr.sh'), 'utf8');

    assertMarkersInOrder(skillText, ['BBR', '代理安装之前'], 'SKILL.md BBR ordering rule');
    assertLineMarkersInOrder(debianFlowText, ['optional BBR', 'selected proxy'], 'debian-standard.md');
    assert.match(bbrReferenceText, /before proxy installation/i);
    assert.match(bbrScriptText, /net\.core\.default_qdisc=fq/);
    assert.match(bbrScriptText, /net\.ipv4\.tcp_congestion_control=bbr/);
  });

  it('requires MCP config update only after verification and remote script cleanup', () => {
    const skillText = fs.readFileSync(skillPath, 'utf8');
    const handoffText = fs.readFileSync(path.join(referencesDir, 'mcp-handoff.md'), 'utf8');
    const failureText = fs.readFileSync(path.join(referencesDir, 'failure-handling.md'), 'utf8');
    const cleanupText = fs.readFileSync(path.join(featureScriptsDir, 'cleanup.sh'), 'utf8');

    assert.match(skillText, /parallel temporary MCP entry/);
    assert.match(skillText, /final MCP config switch/);
    assertLineMarkersInOrder(
      handoffText,
      ['Add a parallel temporary MCP entry', 'whoami', 'sudo -S', 'ssh-lockdown.sh', 'Final verify', 'switch the intended MCP config'],
      'mcp-handoff.md',
    );
    assert.match(handoffText, /whoami/);
    assert.match(failureText, /If final verification fails, do not remove remote deployment scripts/);
    assertLineMarkersInOrder(cleanupText, ['rm -rf', 'server-init'], 'cleanup.sh');
  });

  it('stages SSH hardening so the agent is not locked out during port or password changes', () => {
    const skillText = fs.readFileSync(skillPath, 'utf8');
    const handoffText = fs.readFileSync(path.join(referencesDir, 'mcp-handoff.md'), 'utf8');
    const lockdownFlowText = fs.readFileSync(path.join(referencesDir, 'flows', 'zheng-key-lockdown.md'), 'utf8');
    const prepareScriptText = fs.readFileSync(path.join(featureScriptsDir, 'ssh-prepare.sh'), 'utf8');
    const lockdownScriptText = fs.readFileSync(path.join(featureScriptsDir, 'ssh-lockdown.sh'), 'utf8');

    assertMarkersInOrder(skillText, ['Never disable root login', 'bootstrap SSH port'], 'SKILL.md SSH safety rule');
    assert.match(skillText, /FINALIZE_SSH_LOCKDOWN=1/);
    assert.match(handoffText, /bootstrap root\/password and old SSH port alive/);
    assertLineMarkersInOrder(handoffText, ['whoami', 'sudo -S'], 'mcp-handoff.md');
    assertLineMarkersInOrder(lockdownFlowText, ['ssh-prepare.sh', 'ssh-lockdown.sh'], 'zheng-key-lockdown.md');
    assert.match(prepareScriptText, /17223/);
    assert.match(prepareScriptText, /PasswordAuthentication|PermitRootLogin|sshd_config/);
    assert.match(lockdownScriptText, /FINALIZE_SSH_LOCKDOWN/);
    assert.match(lockdownScriptText, /PasswordAuthentication|PermitRootLogin|sshd_config/);
  });

  it('keeps fixed password changes scoped to zheng mode', () => {
    const skillText = fs.readFileSync(skillPath, 'utf8');
    const rootFlowText = fs.readFileSync(path.join(referencesDir, 'flows', 'root-password.md'), 'utf8');
    const zhengFlowText = fs.readFileSync(path.join(referencesDir, 'flows', 'zheng-key-lockdown.md'), 'utf8');
    const handoffText = fs.readFileSync(path.join(referencesDir, 'mcp-handoff.md'), 'utf8');

    assert.match(rootFlowText, /change_password: false/);
    assert.match(rootFlowText, /Do not reset root password/);
    assert.doesNotMatch(rootFlowText, /CHANGE_PASSWORD=1/);
    assert.match(rootFlowText, /212243/);
    assert.match(zhengFlowText, /CHANGE_PASSWORD=1/);
    assert.match(zhengFlowText, /zheng sudo password/i);
    assert.doesNotMatch(skillText, /If root password changes in root mode, update the MCP config before reconnecting/);
    assert.match(handoffText, /Do not change root password in root mode/);
  });

  it('is granular enough for weak agents to create and follow task tracking', () => {
    const text = fs.readFileSync(path.join(referencesDir, 'task-tracking.md'), 'utf8');

    assert.match(text, /Task Tracking/i);
    assert.match(text, /pending/i);
    assert.match(text, /in_progress/i);
    assert.match(text, /completed/i);
    assert.match(text, /Stop Condition/i);
    assert.match(text, /Success Check/i);
    assert.match(text, /Keep exactly one task `in_progress`/);
  });
});
