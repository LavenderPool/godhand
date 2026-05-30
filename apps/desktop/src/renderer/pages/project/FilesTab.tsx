import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileCode, FileImage, Folder, File } from "lucide-react";
import { api, type FileTreeNode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function FileIcon({ ext }: { ext?: string }) {
  if (!ext) return <File className="h-4 w-4" />;
  if (["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext)) return <FileImage className="h-4 w-4" />;
  if (["gd", "tscn", "tres", "godot", "cs"].includes(ext)) return <FileCode className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

function TreeNode({
  node,
  projectPath,
  selected,
  onSelect,
  depth = 0,
}: {
  node: FileTreeNode;
  projectPath: string;
  selected: string | null;
  onSelect: (path: string, ext?: string) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const fullPath = `${projectPath}${node.path}`.replace(/\\/g, "/");

  if (node.type === "directory") {
    return (
      <div>
        <button
          className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
          style={{ paddingLeft: depth * 12 + 8 }}
          onClick={() => setOpen(!open)}
        >
          <Folder className="h-4 w-4 shrink-0" />
          {node.name}
        </button>
        {open && node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            projectPath={projectPath}
            selected={selected}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted",
        selected === node.path && "bg-muted"
      )}
      style={{ paddingLeft: depth * 12 + 8 }}
      onClick={() => onSelect(fullPath, node.extension)}
    >
      <FileIcon ext={node.extension} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FilesTab({ projectId, projectPath }: { projectId: string; projectPath: string }) {
  const { t } = useTranslation();
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    api.getFiles(projectId).then((r) => setTree(r.tree ?? [])).catch(console.error);
  }, [projectId]);

  const handleSelect = (path: string, ext?: string) => {
    setSelectedPath(path);
    if (ext && ["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext)) {
      setPreview(api.imageUrl(path));
    } else {
      setPreview(null);
    }
  };

  const openInCursor = async () => {
    if (!selectedPath) return;
    await api.openInCursor(selectedPath);
  };

  return (
    <div className="flex gap-6">
      <div className="w-72 shrink-0 overflow-auto rounded-lg border border-border p-2" style={{ maxHeight: "70vh" }}>
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            projectPath={projectPath}
            selected={selectedPath?.replace(projectPath, "") ?? null}
            onSelect={handleSelect}
          />
        ))}
      </div>

      <div className="flex-1">
        {selectedPath && (
          <div className="mb-4">
            <p className="mb-2 truncate text-sm text-muted-foreground">{selectedPath}</p>
            <Button variant="outline" size="sm" onClick={openInCursor}>
              {t("files.openInCursor")}
            </Button>
          </div>
        )}
        {preview ? (
          <div>
            <p className="mb-2 text-sm font-medium">{t("files.preview")}</p>
            <img src={preview} alt="preview" className="max-h-96 max-w-full rounded-lg border border-border" />
          </div>
        ) : selectedPath ? (
          <p className="text-sm text-muted-foreground">Select an image file for preview</p>
        ) : null}
      </div>
    </div>
  );
}
