import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);
const VAULT_DIR = path.join(process.cwd(), "vault");

// Talk to Rey's vault checkout is otherwise read-only after build time --
// found via testing that no push step existed anywhere, so any note edit
// made during a conversation was silently lost on the next deploy and
// never reached the real reyse-vault repo. Called after every turn (and
// after every background task) that might have touched the vault.
// Fire-and-forget: a sync failure must never fail the turn that triggered
// it, same pattern as aiUsageLog's logging.
export async function syncVaultToGitHub(commitMessage: string): Promise<void> {
  try {
    const { stdout: status } = await execFileAsync("git", ["-C", VAULT_DIR, "status", "--porcelain"]);
    if (!status.trim()) return;

    await execFileAsync("git", ["-C", VAULT_DIR, "add", "-A"]);
    await execFileAsync("git", [
      "-C", VAULT_DIR,
      "-c", "user.email=rey@reyse.co.uk",
      "-c", "user.name=Rey (Talk to Rey)",
      "commit", "-m", commitMessage,
    ]);
    // The container's clone can fall behind if the vault changed elsewhere
    // (e.g. a Claude Code session) since this container last deployed --
    // rebase onto the latest before pushing rather than risk a rejected push.
    try {
      await execFileAsync("git", ["-C", VAULT_DIR, "pull", "--rebase"]);
    } catch (rebaseErr) {
      // A real conflict leaves the clone mid-rebase, which would break every
      // sync after this one -- abort back to a clean state and leave this
      // turn's commit unpushed (it stays local, retried on the next sync)
      // rather than let the container's checkout get stuck.
      await execFileAsync("git", ["-C", VAULT_DIR, "rebase", "--abort"]).catch(() => {});
      throw rebaseErr;
    }
    await execFileAsync("git", ["-C", VAULT_DIR, "push"]);
  } catch (err) {
    console.error("Failed to sync vault changes back to GitHub:", err);
  }
}
