import fs from "fs";
import path from "path";
import { CommandLineParser } from "../cli/command-line-parser.js";
import { SSHConfig, SshConnectionConfigMap } from "../models/types.js";

export type SshConfigFileFormat = "array" | "object";

export interface SshConfigFileState {
  configFilePath: string;
  format: SshConfigFileFormat;
  configs: SshConnectionConfigMap;
}

type RawSshConfig = Record<string, unknown>;

function readConfigFile(configFilePath: string): {
  resolvedPath: string;
  rawConfig: unknown;
  format: SshConfigFileFormat;
} {
  const resolvedPath = path.resolve(configFilePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  try {
    const content = fs.readFileSync(resolvedPath, "utf-8");
    const rawConfig = JSON.parse(content);

    if (Array.isArray(rawConfig)) {
      return { resolvedPath, rawConfig, format: "array" };
    }
    if (typeof rawConfig === "object" && rawConfig !== null) {
      return { resolvedPath, rawConfig, format: "object" };
    }

    throw new Error("Config file must contain an array or object of SSH configurations");
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${error.message}`);
    }
    throw error;
  }
}

function normalizeRawConfig(
  rawConfig: unknown,
  format: SshConfigFileFormat,
): SshConnectionConfigMap {
  const configMap: SshConnectionConfigMap = {};

  if (format === "array") {
    for (const entry of rawConfig as RawSshConfig[]) {
      if (!entry.name || !entry.host || !entry.port || !entry.username) {
        throw new Error("Each config in array must include name, host, port, username");
      }
      const normalizedConfig = CommandLineParser.normalizeConfig(entry);
      configMap[String(entry.name)] = normalizedConfig;
    }
    return configMap;
  }

  for (const [name, config] of Object.entries(rawConfig as Record<string, RawSshConfig>)) {
    const normalizedConfig = CommandLineParser.normalizeConfig(config);
    normalizedConfig.name = name;
    configMap[name] = normalizedConfig;
  }

  return configMap;
}

function normalizeStoredState(
  resolvedPath: string,
  rawConfig: unknown,
  format: SshConfigFileFormat,
): SshConfigFileState {
  return {
    configFilePath: resolvedPath,
    format,
    configs: normalizeRawConfig(rawConfig, format),
  };
}

function requireConfigName(config: RawSshConfig): string {
  const name = typeof config.name === "string" ? config.name.trim() : "";
  if (!name) {
    throw new Error("SSH config must include a non-empty name");
  }
  return name;
}

function requireCompleteConnection(config: RawSshConfig): void {
  const requiredFields = ["host", "port", "username"];
  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`SSH config must include ${field}`);
    }
  }

  if (!config.password && !config.privateKey && !config.agent) {
    throw new Error("SSH config must include password, privateKey, or agent");
  }

  CommandLineParser.normalizeConfig(config);
  validateRegexList(config.commandWhitelist, "whitelist", String(config.name));
  validateRegexList(config.commandBlacklist, "blacklist", String(config.name));
}

function validateRegexList(
  patterns: unknown,
  kind: "whitelist" | "blacklist",
  connectionName: string,
): void {
  if (!Array.isArray(patterns)) {
    return;
  }

  for (const pattern of patterns) {
    try {
      new RegExp(String(pattern));
    } catch (error) {
      throw new Error(
        `Invalid ${kind} pattern for '${connectionName}': ${String(pattern)} (${(error as Error).message})`,
      );
    }
  }
}

function toStoredConfig(config: RawSshConfig, includeName: boolean): RawSshConfig {
  const storedConfig: RawSshConfig = {};
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) {
      storedConfig[key] = value;
    }
  }
  if (!includeName) {
    delete storedConfig.name;
  }
  return storedConfig;
}

function writeJsonFile(configFilePath: string, rawConfig: unknown): void {
  const dir = path.dirname(configFilePath);
  const base = path.basename(configFilePath);
  const tempPath = path.join(
    dir,
    `.${base}.${process.pid}.${Date.now()}.tmp`,
  );
  const currentMode = fs.statSync(configFilePath).mode & 0o777;

  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(rawConfig, null, 2)}\n`, {
      mode: 0o600,
    });
    fs.chmodSync(tempPath, currentMode);
    fs.renameSync(tempPath, configFilePath);
  } catch (error) {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors for a failed atomic write.
    }
    throw error;
  }
}

export function loadSshConfigFile(configFilePath: string): SshConfigFileState {
  const { resolvedPath, rawConfig, format } = readConfigFile(configFilePath);
  return normalizeStoredState(resolvedPath, rawConfig, format);
}

export function upsertSshConfigFile(
  configFilePath: string,
  config: RawSshConfig,
): SshConfigFileState {
  const { resolvedPath, rawConfig, format } = readConfigFile(configFilePath);
  const name = requireConfigName(config);
  requireCompleteConnection(config);

  if (format === "array") {
    const entries = [...(rawConfig as RawSshConfig[])];
    const existingIndex = entries.findIndex((entry) => entry.name === name);
    const storedConfig = toStoredConfig({ ...config, name }, true);
    if (existingIndex >= 0) {
      entries[existingIndex] = storedConfig;
    } else {
      entries.push(storedConfig);
    }
    writeJsonFile(resolvedPath, entries);
    return normalizeStoredState(resolvedPath, entries, format);
  }

  const configObject = { ...(rawConfig as Record<string, RawSshConfig>) };
  configObject[name] = toStoredConfig(config, false);
  writeJsonFile(resolvedPath, configObject);
  return normalizeStoredState(resolvedPath, configObject, format);
}

export function removeSshConfigFile(
  configFilePath: string,
  name: string,
): SshConfigFileState {
  const { resolvedPath, rawConfig, format } = readConfigFile(configFilePath);
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("SSH config name must be non-empty");
  }

  if (format === "array") {
    const entries = (rawConfig as RawSshConfig[]).filter(
      (entry) => entry.name !== normalizedName,
    );
    writeJsonFile(resolvedPath, entries);
    return normalizeStoredState(resolvedPath, entries, format);
  }

  const configObject = { ...(rawConfig as Record<string, RawSshConfig>) };
  delete configObject[normalizedName];
  writeJsonFile(resolvedPath, configObject);
  return normalizeStoredState(resolvedPath, configObject, format);
}

export function redactSshConfig(config: SSHConfig): Omit<
  SSHConfig,
  "password" | "privateKey" | "passphrase"
> & {
  password?: string;
  privateKey?: string;
  passphrase?: string;
} {
  return {
    ...config,
    password: config.password ? "***" : undefined,
    privateKey: config.privateKey ? "***" : undefined,
    passphrase: config.passphrase ? "***" : undefined,
  };
}
