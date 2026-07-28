import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export const signupSchema = credentialsSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
