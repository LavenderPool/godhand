const MEMORY_URL = process.env.MEMORY_SERVICE_URL ?? "http://localhost:8765";

export async function isMemoryOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${MEMORY_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function memoryAdd(projectId: string, prompt: string, result: string) {
  const res = await fetch(`${MEMORY_URL}/memory/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, prompt, result }),
  });
  if (!res.ok) throw new Error(`Memory add failed: ${res.status}`);
  return res.json();
}

export async function memorySearch(projectId: string, query: string) {
  const url = new URL(`${MEMORY_URL}/memory/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("project_id", projectId);

  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Memory search failed: ${res.status}`);
  return res.json();
}
