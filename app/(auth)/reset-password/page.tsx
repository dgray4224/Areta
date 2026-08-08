"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { newPasswordSchema, type NewPasswordInput } from "@/platform/auth/schema";
import { updatePassword } from "@/platform/auth/actions";
import { FormField, TextInput } from "@/platform/ui/FormField";
import { Card } from "@/platform/ui/Card";
import { Button } from "@/platform/ui/Button";
import { Reveal } from "@/platform/ui/Reveal";

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordInput>({ resolver: zodResolver(newPasswordSchema) });

  const onSubmit = (values: NewPasswordInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await updatePassword(values.password);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setDone(true);
      window.location.href = "/dashboard";
    });
  };

  if (done) {
    return (
      <Reveal className="w-full max-w-sm">
        <Card className="text-center">
          <h1 className="text-lg font-semibold">Password updated</h1>
          <p className="mt-2 text-sm text-neutral-500">Taking you to your dashboard…</p>
        </Card>
      </Reveal>
    );
  }

  return (
    <Reveal className="w-full max-w-sm">
      <Card className="space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <h1 className="text-lg font-semibold">Set a new password</h1>

          <FormField label="New password" htmlFor="password" error={errors.password?.message}>
            <TextInput
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
          </FormField>

          <FormField
            label="Confirm password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
          >
            <TextInput
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
          </FormField>

          {serverError ? (
            <p className="text-sm text-red-600">
              {serverError}
              {serverError.toLowerCase().includes("session") || serverError.toLowerCase().includes("expired")
                ? " Request a new link from the forgot-password page."
                : ""}
            </p>
          ) : null}

          <Button type="submit" variant="primary" disabled={isPending} className="w-full">
            {isPending ? "Saving…" : "Save new password"}
          </Button>
        </form>
      </Card>
    </Reveal>
  );
}
