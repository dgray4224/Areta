"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/platform/auth/schema";
import { requestPasswordReset } from "@/platform/auth/actions";
import { FormField, TextInput } from "@/platform/ui/FormField";

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = (values: ForgotPasswordInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(values.email);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setSent(true);
    });
  };

  if (sent) {
    return (
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 p-6 text-center dark:border-neutral-800">
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-neutral-500">
          If an account uses that address, we sent a link to reset your password.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
      noValidate
    >
      <h1 className="text-lg font-semibold">Reset your password</h1>
      <p className="text-sm text-neutral-500">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>

      <FormField label="Email" htmlFor="email" error={errors.email?.message}>
        <TextInput id="email" type="email" autoComplete="email" {...register("email")} />
      </FormField>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {isPending ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-center text-sm text-neutral-500">
        <Link href="/login" className="underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}
