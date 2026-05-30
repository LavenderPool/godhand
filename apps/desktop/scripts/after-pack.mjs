import { existsSync, rmSync } from "fs";
import { join } from "path";

function cleanupBetterSqlite3(appOutDir) {
  const root = join(appOutDir, "resources", "app.asar.unpacked", "node_modules", "better-sqlite3");
  if (!existsSync(root)) return;

  const removablePaths = [
    "bin",
    "src",
    "deps",
    "build/deps",
    "build/Release/obj",
    "binding.gyp",
    "README.md",
    "LICENSE",
  ];

  for (const relativePath of removablePaths) {
    rmSync(join(root, relativePath), { recursive: true, force: true });
  }

  const releaseDir = join(root, "build", "Release");
  if (!existsSync(releaseDir)) return;

  for (const entry of [
    "better_sqlite3.exp",
    "better_sqlite3.iobj",
    "better_sqlite3.ipdb",
    "better_sqlite3.lib",
    "sqlite3.lib",
    "test_extension.exp",
    "test_extension.iobj",
    "test_extension.ipdb",
    "test_extension.lib",
    "test_extension.node",
  ]) {
    rmSync(join(releaseDir, entry), { force: true });
  }

  for (const entry of [
    "better_sqlite3.vcxproj",
    "better_sqlite3.vcxproj.filters",
    "test_extension.vcxproj",
    "test_extension.vcxproj.filters",
  ]) {
    rmSync(join(root, "build", entry), { force: true });
  }
}

export default async function afterPack(context) {
  cleanupBetterSqlite3(context.appOutDir);
}
