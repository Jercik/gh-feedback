/**
 * Message input helpers for reading from file or stdin.
 */

import * as fs from "node:fs/promises";
import * as readline from "node:readline/promises";
import { exitWithMessage } from "./git-helpers.js";

export async function readMessageFromFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content.trim();
  } catch (error) {
    exitWithMessage(
      `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function readMessageFromStdin(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  if (process.stdin.isTTY) {
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
