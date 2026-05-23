"use client";

import { useState } from "react";

export function useEntityModal<T>() {
  const [open, setOpen] = useState(false);
  const [entity, setEntity] = useState<T | null>(null);

  return {
    open,
    entity,
    openAdd() {
      setEntity(null);
      setOpen(true);
    },
    openEdit(e: T) {
      setEntity(e);
      setOpen(true);
    },
    close() {
      setOpen(false);
    },
  };
}
