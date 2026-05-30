#!/usr/bin/env python3
"""Minimal agentmemory REST wrapper for GodHand."""

from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import uvicorn

app = FastAPI()
_store: list[dict] = []


class MemoryAdd(BaseModel):
    project_id: str
    prompt: str
    result: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/memory/add")
def add_memory(body: MemoryAdd):
    entry = {"project_id": body.project_id, "prompt": body.prompt, "result": body.result}
    _store.append(entry)
    return {"added": True, "id": len(_store)}


@app.get("/memory/search")
def search_memory(q: str = "", project_id: Optional[str] = None):
    results = _store
    if project_id:
        results = [r for r in results if r["project_id"] == project_id]
    if q:
        q_lower = q.lower()
        results = [r for r in results if q_lower in r["prompt"].lower() or q_lower in r["result"].lower()]
    return {"results": results}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
