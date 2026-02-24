import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

function getEnvPath(): string {
  const cwd = process.cwd();
  const local = resolve(cwd, ".env");
  if (existsSync(local)) return local;
  const parent = resolve(cwd, "../.env");
  if (existsSync(parent)) return parent;
  return local;
}

export function updateEnvVar(key: string, value: string): void {
  const envPath = getEnvPath();
  let content = "";

  if (existsSync(envPath)) {
    content = readFileSync(envPath, "utf-8");
  }

  const regex = new RegExp(`^${key}=.*$`, "m");
  const newLine = `${key}=${value}`;

  if (regex.test(content)) {
    content = content.replace(regex, newLine);
  } else {
    content = content.trimEnd() + "\n" + newLine + "\n";
  }

  writeFileSync(envPath, content, "utf-8");
  console.log(`[EnvWriter] Updated ${key} in ${envPath}`);
}
