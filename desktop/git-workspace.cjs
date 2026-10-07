// Modified for the Russian community edition, 2026-10-07.
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

function validWorkspace(cwd) {
  try { return typeof cwd === "string" && fs.statSync(cwd).isDirectory(); } catch { return false; }
}

function runGit(cwd, args, timeout = 10_000) {
  return spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true, timeout });
}

function readGitInfo(cwd) {
  if (!validWorkspace(cwd)) return { ok: false, isRepo: false, error: "Папка проекта не существует" };
  const inside = runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
  if (inside.status !== 0 || inside.stdout.trim() !== "true") return { ok: true, isRepo: false, branches: [], dirtyCount: 0 };
  const root = runGit(cwd, ["rev-parse", "--show-toplevel"]).stdout.trim();
  let current = runGit(cwd, ["branch", "--show-current"]).stdout.trim();
  const detached = !current;
  if (!current) current = runGit(cwd, ["rev-parse", "--short", "HEAD"]).stdout.trim() || "detached";
  const statusLines = (runGit(cwd, ["status", "--porcelain"]).stdout || "").split(/\r?\n/).filter(Boolean);
  const refs = runGit(cwd, ["for-each-ref", "--sort=-committerdate", "--format=%(refname:short)%09%(HEAD)%09%(upstream:short)%09%(committerdate:relative)", "refs/heads"]);
  const branches = (refs.stdout || "").split(/\r?\n/).filter(Boolean).slice(0, 120).map((line) => {
    const [name, head, upstream, updated] = line.split("\t");
    return { name, current: head === "*", upstream: upstream || null, updated: updated || null };
  });
  const currentBranch = branches.find((branch) => branch.current);
  let ahead = 0; let behind = 0;
  if (currentBranch?.upstream) {
    const divergence = runGit(cwd, ["rev-list", "--left-right", "--count", `HEAD...${currentBranch.upstream}`]);
    const [left, right] = divergence.stdout.trim().split(/\s+/).map(Number);
    ahead = Number.isFinite(left) ? left : 0; behind = Number.isFinite(right) ? right : 0;
  }
  return {
    ok: true, isRepo: true, root, current, detached, branches,
    dirtyCount: statusLines.length,
    stagedCount: statusLines.filter((line) => line[0] !== " " && line[0] !== "?").length,
    upstream: currentBranch?.upstream || null, ahead, behind
  };
}

function switchGitBranch(cwd, branch) {
  const info = readGitInfo(cwd);
  if (!info.ok || !info.isRepo) return { ok: false, error: "Текущий проект не является репозиторием Git" };
  if (typeof branch !== "string" || !info.branches.some((item) => item.name === branch)) return { ok: false, error: "Локальная ветка не существует" };
  const result = runGit(cwd, ["switch", branch], 30_000);
  if (result.status !== 0) return { ok: false, error: (result.stderr || result.stdout || "Не удалось переключить ветку").trim() };
  return { ok: true, message: (result.stderr || result.stdout || "").trim(), info: readGitInfo(cwd) };
}

function createGitBranch(cwd, branch) {
  const info = readGitInfo(cwd);
  const name = String(branch || "").trim();
  if (!info.ok || !info.isRepo) return { ok: false, error: "Текущий проект не является репозиторием Git" };
  const check = runGit(cwd, ["check-ref-format", "--branch", name]);
  if (!name || check.status !== 0) return { ok: false, error: "Введите допустимое название ветки Git" };
  if (info.branches.some((item) => item.name === name)) return { ok: false, error: "Такая ветка уже существует" };
  const result = runGit(cwd, ["switch", "-c", name], 30_000);
  if (result.status !== 0) return { ok: false, error: (result.stderr || result.stdout || "Не удалось создать ветку").trim() };
  return { ok: true, message: (result.stderr || result.stdout || "").trim(), info: readGitInfo(cwd) };
}

module.exports = { createGitBranch, readGitInfo, switchGitBranch };
