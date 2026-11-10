/**
 * Parse the reply message's source (-m, -f, or an explicit --interactive request), then read it.
 * Stdin is never read implicitly: an agent's stdin can stay open without sending EOF.
 */

import * as fs from "node:fs/promises";
import * as readline from "node:readline/promises";
import { exitWithMessage } from "./git-helpers.js";

async function readMessageFromFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const message = content.trim();
    if (!message) {
      return exitWithMessage("Error: File is empty.");
    }
    return message;
  } catch (error) {
    return exitWithMessage(
      `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function readMessageFromStdin(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  const isCI = Boolean(process.env.CI);
  if (process.stdin.isTTY && !isCI) {
    console.error(`Enter your ${prompt} (press Ctrl+D when done):`);
    console.error("---");
  }

  const lines: string[] = [];

  try {
    for await (const line of rl) {
      lines.push(line);
    }
  } finally {
    rl.close();
  }

  const message = lines.join("\n").trim();

  if (!message) {
    exitWithMessage(`Error: Empty ${prompt} message.`);
  }

  return message;
}

export type MessageSource =
  | { kind: "text"; text: string }
  | { kind: "file"; path: string }
  | { kind: "stdin" };

export function parseMessageSource(
  options: { message?: string; bodyFile?: string; interactive?: boolean },
  prompt: string,
): MessageSource {
  if (options.bodyFile !== undefined) {
    return options.bodyFile === "-" ? { kind: "stdin" } : { kind: "file", path: options.bodyFile };
  }
  if (options.message !== undefined) {
    const text = options.message.trim();
    return text ? { kind: "text", text } : exitWithMessage(`Error: Empty ${prompt} message.`);
  }
  if (options.interactive) {
    return { kind: "stdin" };
  }
  return exitWithMessage(
    `Error: Missing ${prompt} message. Provide -m/--message or -f/--body-file (use "-f -" to read stdin), or pass --interactive to type it.`,
  );
}

export async function readMessage(source: MessageSource, prompt: string): Promise<string> {
  if (source.kind === "text") {
    return source.text;
  }
  return source.kind === "file" ? readMessageFromFile(source.path) : readMessageFromStdin(prompt);
}
