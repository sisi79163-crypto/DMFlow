"use client";
import { useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Trash2 } from "lucide-react";
import type { Flow } from "@/lib/flow";
const kinds = [
  "message",
  "question",
  "condition",
  "link",
  "tag",
  "wait",
] as const;
export default function FlowBuilder({
  value,
  onChange,
  ar,
}: {
  value: Flow;
  onChange: (v: Flow) => void;
  ar: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [kind, setKind] = useState<(typeof kinds)[number]>("message"),
    [branch, setBranch] = useState("yes");
  const n = value.nodes.find((n) => n.id === selected);
  const connect = useCallback(
    (c: Connection) =>
      onChange({
        ...value,
        edges: addEdge(
          {
            ...c,
            label:
              value.nodes.find((n) => n.id === c.source)?.data.kind ===
              "condition"
                ? branch
                : undefined,
          },
          value.edges,
        ),
      }),
    [value, onChange, branch],
  );
  return (
    <div className="flow-editor">
      <div className="flow-toolbar">
        <strong>{ar ? "مسار المحادثة" : "Conversation flow"}</strong>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          {kinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <button
          type="button"
          className="button"
          onClick={() => {
            const id = crypto.randomUUID();
            onChange({
              ...value,
              nodes: [
                ...value.nodes,
                {
                  id,
                  position: { x: 200, y: value.nodes.length * 130 },
                  data: { kind, label: kind },
                },
              ],
            });
            setSelected(id);
          }}
        >
          <Plus size={16} />
          {ar ? "إضافة خطوة" : "Add step"}
        </button>
        <select
          aria-label="Condition branch"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
        >
          <option value="yes">yes branch</option>
          <option value="no">no branch</option>
        </select>
      </div>
      <div className="flow-canvas" dir="ltr">
        <ReactFlow
          nodes={value.nodes}
          edges={value.edges}
          onNodesChange={(c: NodeChange[]) =>
            onChange({
              ...value,
              nodes: applyNodeChanges(c, value.nodes) as Flow["nodes"],
            })
          }
          onEdgesChange={(c: EdgeChange[]) =>
            onChange({
              ...value,
              edges: applyEdgeChanges(c, value.edges) as Flow["edges"],
            })
          }
          onConnect={connect}
          onNodeClick={(_, node) => setSelected(node.id)}
          fitView
        >
          <Background gap={22} color="#78839033" />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      {n && (
        <div className="node-inspector">
          <label>
            {ar ? "اسم الخطوة" : "Step name"}
            <input
              value={n.data.label}
              onChange={(e) =>
                onChange({
                  ...value,
                  nodes: value.nodes.map((x) =>
                    x.id === n.id
                      ? { ...x, data: { ...x.data, label: e.target.value } }
                      : x,
                  ),
                })
              }
            />
          </label>
          {["message", "question", "link"].includes(n.data.kind) && (
            <label>
              {ar ? "نص الرسالة" : "Message text"}
              <textarea
                value={n.data.text || ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    nodes: value.nodes.map((x) =>
                      x.id === n.id
                        ? { ...x, data: { ...x.data, text: e.target.value } }
                        : x,
                    ),
                  })
                }
              />
            </label>
          )}
          {["condition", "link", "tag"].includes(n.data.kind) && (
            <label>
              {n.data.kind === "condition"
                ? ar
                  ? "الرد يحتوي على"
                  : "Reply contains"
                : n.data.kind === "link"
                  ? "HTTPS URL"
                  : "Tag"}
              <input
                value={n.data.value || ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    nodes: value.nodes.map((x) =>
                      x.id === n.id
                        ? { ...x, data: { ...x.data, value: e.target.value } }
                        : x,
                    ),
                  })
                }
              />
            </label>
          )}
          <button
            type="button"
            className="button danger"
            onClick={() => {
              onChange({
                nodes: value.nodes.filter((x) => x.id !== n.id),
                edges: value.edges.filter(
                  (e) => e.source !== n.id && e.target !== n.id,
                ),
              });
              setSelected(null);
            }}
          >
            <Trash2 size={15} />
            {ar ? "حذف الخطوة" : "Delete step"}
          </button>
        </div>
      )}
      <p className="hint">
        {ar
          ? "اسحب لتغيير موضع الخطوات. اربط النقاط لإنشاء المسار. الشرط يحتاج فرعين yes وno. تبدأ المتابعة فقط بعد رد العميل."
          : "Drag steps and connect their handles. Conditions require yes/no branches. Follow-up begins only after a customer reply."}
      </p>
    </div>
  );
}
