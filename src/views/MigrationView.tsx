"use client";

import { useModel } from "@/lib/model/ModelContext";
import {
  migrationStatusColors,
  migrationStatusLabels,
  nodeVisual,
} from "@/lib/theme";

interface MigrationViewProps {
  onSelect: (id: string | null) => void;
}

function NodeChip({
  id,
  onSelect,
}: {
  id: string;
  onSelect: (id: string) => void;
}) {
  const { nodeById } = useModel();
  const def = nodeById.get(id);
  if (!def) return null;
  const accent = nodeVisual(def).accent;
  return (
    <button
      onClick={() => onSelect(id)}
      className="rounded-md px-2.5 py-1 text-[13px] font-medium transition-opacity hover:opacity-80"
      style={{
        background: `${accent}1f`,
        color: accent,
        border: `1px solid ${accent}99`,
      }}
    >
      {def.name}
    </button>
  );
}

export function MigrationView({ onSelect }: MigrationViewProps) {
  const { migrations } = useModel();
  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <p className="mx-auto mb-6 max-w-3xl text-sm text-slate-300">
        Every modernization effort currently in flight, what it replaces, and
        how far along it is. Click a system chip for its full fact sheet.
      </p>
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
        {migrations.map((migration) => (
          <div
            key={migration.id}
            className="rounded-xl border border-slate-700 bg-[#0e1626] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-slate-100">
                {migration.title}
              </h3>
              <span
                className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  color: migrationStatusColors[migration.status],
                  background: `${migrationStatusColors[migration.status]}1f`,
                  border: `1px solid ${migrationStatusColors[migration.status]}55`,
                }}
              >
                {migrationStatusLabels[migration.status]}
              </span>
            </div>
            {migration.deadline && (
              <div className="mt-1 text-xs font-medium text-amber-400">
                Deadline: {migration.deadline}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {migration.from.map((id) => (
                <NodeChip key={id} id={id} onSelect={onSelect} />
              ))}
              <span className="text-slate-300">→</span>
              {migration.to.map((id) => (
                <NodeChip key={id} id={id} onSelect={onSelect} />
              ))}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-300">
              {migration.summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
