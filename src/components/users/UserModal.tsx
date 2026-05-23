"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Required"),
  surname: z.string().min(1, "Required"),
  email: z.email("Invalid email"),
  password: z.string().min(6, "Min 6 characters").or(z.literal("")),
  idNumber: z.string().min(1, "Required"),
  role: z.enum(["ADMIN", "RECRUITING", "DISPATCHER", "OPERATIONS", "ACCOUNTING"]),
  phoneNumber: z.string().min(1, "Required"),
  phone2: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  surname: string;
  email: string;
  idNumber: string;
  role: string;
  phoneNumber: string;
  phone2?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
}

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  user?: UserRow | null;
}

const ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "RECRUITING", label: "Recruiting" },
  { value: "DISPATCHER", label: "Dispatcher" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "ACCOUNTING", label: "Accounting" },
];

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function UserModal({ open, onClose, onSaved, user }: UserModalProps) {
  const isEdit = !!user;
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", role: "DISPATCHER" },
  });

  useEffect(() => {
    if (open) {
      setApiError(null);
      reset({
        name: user?.name ?? "",
        surname: user?.surname ?? "",
        email: user?.email ?? "",
        password: "",
        idNumber: user?.idNumber ?? "",
        role: (user?.role as FormData["role"]) ?? "DISPATCHER",
        phoneNumber: user?.phoneNumber ?? "",
        phone2: user?.phone2 ?? "",
        address: user?.address ?? "",
        emergencyContact: user?.emergencyContact ?? "",
      });
    }
  }, [open, user, reset]);

  function handleClose() {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    onClose();
  }

  async function onSubmit(data: FormData) {
    setApiError(null);
    const body: Partial<FormData> = { ...data };
    if (isEdit && !data.password) delete body.password;

    const res = await fetch(isEdit ? `/api/users/${user!.id}` : "/api/users", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setApiError(json.error ?? "Something went wrong. Please try again.");
      return;
    }

    onSaved();
    onClose();
  }

  const roleValue = watch("role");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Add User"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" error={errors.name?.message} required>
              <Input {...register("name")} placeholder="John" autoFocus />
            </FormField>
            <FormField label="Last Name" error={errors.surname?.message} required>
              <Input {...register("surname")} placeholder="Doe" />
            </FormField>
          </div>

          <FormField label="Email" error={errors.email?.message} required>
            <Input {...register("email")} type="email" placeholder="john@company.com" />
          </FormField>

          <FormField
            label={isEdit ? "New Password (leave blank to keep)" : "Password"}
            error={errors.password?.message}
            required={!isEdit}
          >
            <Input {...register("password")} type="password" placeholder="••••••••" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="ID Number" error={errors.idNumber?.message} required>
              <Input {...register("idNumber")} placeholder="ID001" />
            </FormField>
            <FormField label="Role" required>
              <Select value={roleValue} onValueChange={(v) => setValue("role", v as FormData["role"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Phone" error={errors.phoneNumber?.message} required>
              <Input {...register("phoneNumber")} placeholder="+1 555 0000" />
            </FormField>
            <FormField label="Phone 2">
              <Input {...register("phone2")} placeholder="+1 555 0001" />
            </FormField>
          </div>

          <FormField label="Address">
            <Input {...register("address")} placeholder="123 Main St" />
          </FormField>

          <FormField label="Emergency Contact">
            <Input {...register("emergencyContact")} placeholder="Jane Doe +1 555 9999" />
          </FormField>

          {apiError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700">
              {apiError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="bg-black text-white hover:bg-gray-800" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
