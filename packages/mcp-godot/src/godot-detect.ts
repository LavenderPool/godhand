import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join, normalize } from "path";
import { execa } from "execa";

async function isValidGodotExecutable(path: string): Promise<boolean> {
  if (!existsSync(path)) return false;
  try {
    await execa(path, ["--version"], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

function preferNonConsole(paths: string[]): string[] {
  const unique = [...new Set(paths.map((p) => normalize(p)))];
  const regular = unique.filter((p) => !p.toLowerCase().includes("_console"));
  const consoleOnly = unique.filter((p) => p.toLowerCase().includes("_console"));
  return [...regular, ...consoleOnly];
}

function findGodotExeInDir(dir: string, depth: number, maxDepth: number): string[] {
  if (!existsSync(dir) || depth > maxDepth) return [];

  const found: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isFile() && /^Godot.*\.exe$/i.test(entry.name)) {
        found.push(normalize(fullPath));
      } else if (entry.isDirectory() && depth < maxDepth) {
        found.push(...findGodotExeInDir(fullPath, depth + 1, maxDepth));
      }
    }
  } catch {
    /* ignore unreadable directories */
  }
  return found;
}

export async function detectGodotExecutable(preferredPath?: string): Promise<string | null> {
  const candidates: string[] = [];

  const queue = (path?: string) => {
    if (path?.trim()) candidates.push(normalize(path.trim()));
  };

  queue(preferredPath);
  queue(process.env.GODOT_PATH);

  for (const path of preferNonConsole(candidates)) {
    if (await isValidGodotExecutable(path)) return path;
  }

  if (process.platform === "win32") {
    try {
      const { stdout } = await execa("where.exe", ["Godot*.exe"], { reject: false });
      for (const line of stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) candidates.push(normalize(trimmed));
      }
    } catch {
      /* where.exe unavailable */
    }

    const home = homedir();
    const portableRoots = [
      join(home, "Desktop"),
      join(home, "Downloads"),
      join(process.env.LOCALAPPDATA ?? join(home, "AppData", "Local"), "Programs"),
    ];
    for (const root of portableRoots) {
      candidates.push(...findGodotExeInDir(root, 0, 3));
    }

    candidates.push(
      "C:\\Program Files\\Godot\\Godot.exe",
      "C:\\Program Files\\Godot_4\\Godot.exe"
    );
  } else if (process.platform === "darwin") {
    candidates.push("/Applications/Godot.app/Contents/MacOS/Godot");
  } else {
    candidates.push("/usr/bin/godot", "/usr/local/bin/godot");
  }

  candidates.push("godot");

  for (const path of preferNonConsole(candidates)) {
    if (await isValidGodotExecutable(path)) return path;
  }

  return null;
}
