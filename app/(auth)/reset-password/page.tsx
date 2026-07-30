"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { newPasswordSchema, type NewPasswordInput } from "@/platform/auth/schema";
import { updatePassword } from "@/platform/auth/actions";
import { FormField, TextInput } from "@/platform/ui/FormField";

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
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 p-6 text-center dark:border-neutral-800">
        <h1 className="text-lg font-semibold">Password updated</h1>
        <p className="mt-2 text-sm text-neutral-500">Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
      noValidate
    >
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

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {isPending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
