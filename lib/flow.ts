import { z } from "zod";
export const nodeSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.literal("default").optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    label: z.string().max(80),
    kind: z.enum([
      "comment",
      "dm",
      "wait",
      "message",
      "question",
      "condition",
      "link",
      "tag",
    ]),
    text: z.string().max(1000).optional(),
    value: z.string().max(1000).optional(),
  }),
});
export const flowSchema = z
  .object({
    nodes: z.array(nodeSchema).max(40),
    edges: z
      .array(
        z.object({
          id: z.string(),
          source: z.string(),
          target: z.string(),
          sourceHandle: z.string().nullable().optional(),
          label: z.string().optional(),
        }),
      )
      .max(80),
  })
  .superRefine((f, c) => {
    const ids = new Set(f.nodes.map((n) => n.id));
    if (ids.size !== f.nodes.length)
      c.addIssue({ code: "custom", message: "Duplicate node IDs" });
    if (
      f.nodes.length &&
      f.nodes.filter((n) => n.data.kind === "comment").length !== 1
    )
      c.addIssue({
        code: "custom",
        message: "Exactly one comment entry is required",
      });
    for (const e of f.edges)
      if (!ids.has(e.source) || !ids.has(e.target))
        c.addIssue({ code: "custom", message: "Invalid edge" });
    for (const n of f.nodes) {
      const edges = f.edges.filter((e) => e.source === n.id);
      if (n.data.kind === "condition") {
        if (
          edges.length !== 2 ||
          !edges.some((e) => e.label === "yes") ||
          !edges.some((e) => e.label === "no")
        )
          c.addIssue({
            code: "custom",
            message: "Conditions need yes and no branches",
          });
      } else if (edges.length > 1)
        c.addIssue({ code: "custom", message: "Only conditions may branch" });
    }
    const visit = (id: string, path: Set<string>): boolean => {
      if (path.has(id)) return true;
      return f.edges
        .filter((e) => e.source === id)
        .some((e) => visit(e.target, new Set([...path, id])));
    };
    if (f.nodes.some((n) => visit(n.id, new Set())))
      c.addIssue({ code: "custom", message: "Cycles are not supported" });
  });
export type Flow = z.infer<typeof flowSchema>;
export const defaultFlow: Flow = {
  nodes: [
    {
      id: "start",
      position: { x: 200, y: 0 },
      data: { label: "Comment", kind: "comment" },
    },
    {
      id: "dm",
      position: { x: 200, y: 130 },
      data: { label: "Private reply", kind: "dm" },
    },
    {
      id: "wait",
      position: { x: 200, y: 260 },
      data: { label: "Wait for reply", kind: "wait" },
    },
  ],
  edges: [
    { id: "e1", source: "start", target: "dm" },
    { id: "e2", source: "dm", target: "wait" },
  ],
};
export const nextNode = (f: Flow, id: string, branch?: string) =>
  f.edges.find((e) => e.source === id && (!branch || e.label === branch))
    ?.target || null;
