"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { credentialsSchema, type CredentialsInput } from "@/platform/auth/schema";
import { signInWithPassword } from "@/platform/auth/actions";
import { FormField, TextInput } from "@/platform/ui/FormField";
import { Card } from "@/platform/ui/Card";
import { Button } from "@/platform/ui/Button";
import { Reveal } from "@/platform/ui/Reveal";

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CredentialsInput>({ resolver: zodResolver(credentialsSchema) });

  const onSubmit = (values: CredentialsInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await signInWithPassword(values.email, values.password);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      window.location.href = "/dashboard";
    });
  };

  return (
    <Reveal className="w-full max-w-sm">
      <Card className="space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <h1 className="text-lg font-semibold">Log in</h1>

          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <TextInput id="email" type="email" autoComplete="email" {...register("email")} />
          </FormField>

          <FormField label="Password" htmlFor="password" error={errors.password?.message}>
            <TextInput
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
          </FormField>

          <p className="text-right text-sm">
            <Link href="/forgot-password" className="text-neutral-500 underline">
              Forgot password?
            </Link>
          </p>

          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

          <Button type="submit" variant="primary" disabled={isPending} className="w-full">
            {isPending ? "Logging in…" : "Log in"}
          </Button>

          <p className="text-center text-sm text-neutral-500">
            Need an account?{" "}
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </p>
        </form>
      </Card>
    </Reveal>
  );
}
