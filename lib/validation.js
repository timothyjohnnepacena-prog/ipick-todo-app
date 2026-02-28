// lib/validations.js
import { z } from "zod";

export const taskSchema = z.object({
  text: z.string().min(1, "Task cannot be empty").max(500, "Task too long"),
  listId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid List ID"),
});

export const listSchema = z.object({
  name: z.string().min(1, "Name required").max(50, "Name too long"),
});