"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { staticModel, type Model } from "@/data/model";

interface ModelContextValue {
  model: Model;
  /** Overrides the model everywhere it's read via `useModel()`. `null` reverts to the real static model. */
  setDraftModel: (model: Model | null) => void;
}

const ModelContext = createContext<ModelContextValue>({
  model: staticModel,
  setDraftModel: () => {},
});

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [draftModel, setDraftModel] = useState<Model | null>(null);
  const value = useMemo(
    () => ({ model: draftModel ?? staticModel, setDraftModel }),
    [draftModel],
  );
  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
}

export function useModel(): Model {
  return useContext(ModelContext).model;
}

/** Only the chat feature needs to swap the model — everything else just reads it. */
export function useSetDraftModel(): (model: Model | null) => void {
  return useContext(ModelContext).setDraftModel;
}
