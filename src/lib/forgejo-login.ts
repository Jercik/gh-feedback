import * as z from "zod";

// Forgejo's own username rule (modules/validation): an alphanumeric start, then word characters,
// dots or dashes, never two separators in a row and never a trailing one.
export const ForgejoLogin = z
  .string()
  .regex(/^[\dA-Za-z][\w.-]*$/u)
  .refine((login) => !/[-._]{2,}|[-._]$/u.test(login))
  .brand<"ForgejoLogin">();

export type ForgejoLogin = z.infer<typeof ForgejoLogin>;
