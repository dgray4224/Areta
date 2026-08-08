"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/platform/auth/schema";
import { requestPasswordReset } from "@/platform/auth/actions";
import { FormField, TextInput } from "@/platform/ui/FormField";
import { Card } from "@/platform/ui/Card";
import { Button } from "@/platform/ui/Button";
import { Reveal } from "@/platform/ui/Reveal";

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
      <Reveal className="w-full max-w-sm">
        <Card className="text-center">
          <h1 className="text-lg font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-neutral-500">
            If an account uses that address, we sent a link to reset your password.
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm underline">
            Back to login
          </Link>
        </Card>
      </Reveal>
    );
  }

  return (
    <Reveal className="w-full max-w-sm">
      <Card className="space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <h1 className="text-lg font-semibold">Reset your password</h1>
          <p className="text-sm text-neutral-500">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>

          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <TextInput id="email" type="email" autoComplete="email" {...register("email")} />
          </FormField>

          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

          <Button type="submit" variant="primary" disabled={isPending} className="w-full">
            {isPending ? "Sending…" : "Send reset link"}
          </Button>

          <p className="text-center text-sm text-neutral-500">
            <Link href="/login" className="underline">
              Back to login
            </Link>
          </p>
        </form>
      </Card>
    </Reveal>
  );
}
