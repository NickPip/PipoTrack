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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function UserModal({ open, onClose, onSaved, user }: UserModalProps) {
  const isEdit = !!user;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", role: "DISPATCHER" },
  });

  useEffect(() => {
    if (open) {
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

  async function onSubmit(data: FormData) {
    const body: Partial<FormData> = { ...data };
    if (isEdit && !data.password) delete body.password;

    const res = await fetch(isEdit ? `/api/users/${user!.id}` : "/api/users", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onSaved();
      onClose();
    }
  }

  const roleValue = watch("role");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Add User"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>First Name</Label>
              <Input {...register("name")} placeholder="John" />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input {...register("surname")} placeholder="Doe" />
              {errors.surname && <p className="text-xs text-red-500">{errors.surname.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input {...register("email")} type="email" placeholder="john@company.com" />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>{isEdit ? "New Password (leave blank to keep)" : "Password"}</Label>
            <Input {...register("password")} type="password" placeholder="••••••••" />
            {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ID Number</Label>
              <Input {...register("idNumber")} placeholder="ID001" />
              {errors.idNumber && <p className="text-xs text-red-500">{errors.idNumber.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register("phoneNumber")} placeholder="+1 555 0000" />
              {errors.phoneNumber && <p className="text-xs text-red-500">{errors.phoneNumber.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Phone 2 (optional)</Label>
              <Input {...register("phone2")} placeholder="+1 555 0001" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Address (optional)</Label>
            <Input {...register("address")} placeholder="123 Main St" />
          </div>

          <div className="space-y-1.5">
            <Label>Emergency Contact (optional)</Label>
            <Input {...register("emergencyContact")} placeholder="Jane Doe +1 555 9999" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-black text-white hover:bg-gray-800" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
