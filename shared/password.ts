import { z } from "zod";

const fields = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(128, "Password must be 128 characters or fewer."),
  newPassword: z.string().min(8, "Use at least 8 characters for your new password.").max(128, "Password must be 128 characters or fewer."),
}).strict();
const differentPassword = (value: { currentPassword: string; newPassword: string }) => value.currentPassword !== value.newPassword;
const differentMessage = { message: "Choose a password different from your current password.", path: ["newPassword"] };

export const passwordChangeSchema = fields.refine(differentPassword, differentMessage);
export const passwordChangeFormSchema = fields.extend({ confirmPassword: z.string() }).strict()
  .refine(value => value.newPassword === value.confirmPassword, { message: "New passwords do not match.", path: ["confirmPassword"] })
  .refine(differentPassword, differentMessage);
export type PasswordChange = z.infer<typeof passwordChangeSchema>;
export const passwordChangeResultSchema = z.object({ success: z.literal(true), requiresSignIn: z.boolean() });
