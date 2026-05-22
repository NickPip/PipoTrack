"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z.string().min(1, "Required"),
  email: z.email("Invalid email"),
  phone: z.string().min(1, "Required"),
});

type FormData = z.infer<typeof schema>;

export interface OwnerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface OwnerModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  owner?: OwnerRow | null;
}

export default function OwnerModal({ open, onClose, onSaved, owner }: OwnerModalProps) {
  const isEdit = !!owner;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        name: owner?.name ?? "",
        email: owner?.email ?? "",
        phone: owner?.phone ?? "",
      });
    }
  }, [open, owner, reset]);

  async function onSubmit(data: FormData) {
    const res = await fetch(isEdit ? `/api/owners/${owner!.id}` : "/api/owners", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      onSaved();
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Owner" : "Add Owner"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input {...register("name")} placeholder="Acme Logistics LLC" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input {...register("email")} type="email" placeholder="owner@company.com" />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input {...register("phone")} placeholder="+1 555 0000" />
            {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-black text-white hover:bg-gray-800" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add Owner"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
