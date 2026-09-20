import { z } from "zod";
import { HttpError } from "@/server/errors";

const credentialsSchema = z.object({
  username: z.string().min(2).max(24),
  password: z.string().min(8).max(128),
});

export const registerSchema = credentialsSchema.extend({
  username: z.string().min(2, "用户名至少需要 2 位。").max(8, "用户名最多只能有 8 位。"),
  confirmPassword: z.string().min(8).max(128),
}).refine((input) => input.password === input.confirmPassword, {
  path: ["confirmPassword"],
  message: "两次输入的密码不一致。",
});

export const loginSchema = credentialsSchema;

export const messageSchema = z.object({
  content: z.string().trim().min(1, "请先写下一点今天的故事。").max(5000, "这次内容有些长，可以分几次告诉我。"),
});

export const regenerateSchema = z.object({
  feedback: z.string().trim().max(1000).default(""),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  agentName: z.string().trim().min(1).max(24).optional(),
});

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, "INVALID_INPUT", result.error.issues[0]?.message ?? "请求参数不正确。");
  return result.data;
}
