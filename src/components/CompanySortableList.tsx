"use client";

import { useState, type ReactNode } from "react";

export interface CompanySection {
  id: string;
  name: string;
  // ISO timestamp of when we first discovered this company -- used as a proxy
  // for "the provider's own original list order" (we don't persist the raw
  // API index), since a company's discovery order doesn't change afterward.
  createdAt: string;
  element: ReactNode;
}

type SortMode = "az" | "za" | "default";

const SORT_LABELS: Record<SortMode, string> = {
  az: "A-Z",
  za: "Z-A",
  default: "Standart",
};

export default function CompanySortableList({ sections }: { sections: CompanySection[] }) {
  const [sort, setSort] = useState<SortMode>("az");

  const sorted = [...sections].sort((a, b) => {
    if (sort === "az") return a.name.localeCompare(b.name);
    if (sort === "za") return b.name.localeCompare(a.name);
    return a.createdAt.localeCompare(b.createdAt);
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2 text-xs">
        <span className="text-slate-500">Saralash:</span>
        {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setSort(mode)}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              sort === mode ? "bg-violet-600 text-white" : "bg-slate-800/60 text-slate-400 hover:text-slate-200"
            }`}
          >
            {SORT_LABELS[mode]}
          </button>
        ))}
      </div>
      <div className="space-y-6">{sorted.map((s) => s.element)}</div>
    </div>
  );
}
