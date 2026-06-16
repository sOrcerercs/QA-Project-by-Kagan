"use client";
import { useState } from "react";

export type SortDir = "asc" | "desc";

export interface SortableColumn<T> {
  header: string;
  align?: "left" | "right";
  cell: (row: T) => React.ReactNode;
  sortValue: (row: T) => number | string;
  sortable?: boolean; // default true
}

export interface SortableTableProps<T> {
  columns: SortableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  defaultSort?: { col: number; dir: SortDir };
}

// Pure comparator: numbers numerically, otherwise Turkish-locale string compare.
export function compareValues(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "tr");
}

const thBase: React.CSSProperties = {
  textAlign: "left", padding: "8px 10px", fontSize: 10.5, color: "var(--fg-faint)",
  textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
};
const tdBase: React.CSSProperties = {
  padding: "8px 10px", fontSize: 12.5, color: "var(--fg)", borderTop: "1px solid var(--rule)",
};

export default function SortableTable<T>({ columns, rows, rowKey, defaultSort }: SortableTableProps<T>) {
  const [sort, setSort] = useState<{ col: number; dir: SortDir }>(defaultSort ?? { col: 0, dir: "asc" });

  const clickHeader = (col: number) => {
    const c = columns[col];
    if (c.sortable === false) return;
    setSort((s) => {
      if (s.col === col) return { col, dir: s.dir === "asc" ? "desc" : "asc" };
      const numericDefault = rows.length > 0 && typeof c.sortValue(rows[0]) === "number";
      return { col, dir: numericDefault ? "desc" : "asc" };
    });
  };

  const sorted = [...rows].sort((a, b) => {
    const col = columns[sort.col];
    if (!col) return 0;
    const cmp = compareValues(col.sortValue(a), col.sortValue(b));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const arrow = (i: number) => (sort.col === i ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {columns.map((c, i) => {
            const clickable = c.sortable !== false;
            return (
              <th
                key={i}
                onClick={clickable ? () => clickHeader(i) : undefined}
                style={{
                  ...thBase,
                  textAlign: c.align === "right" ? "right" : "left",
                  ...(clickable ? { cursor: "pointer", userSelect: "none" } : {}),
                }}
              >
                {c.header}{arrow(i)}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((c, i) => (
              <td key={i} style={{ ...tdBase, textAlign: c.align === "right" ? "right" : "left" }}>
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
