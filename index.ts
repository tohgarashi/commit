import * as core from "@actions/core";

import getInput from "./lib/input";
import { Repo } from "./lib/repo";
import { Ref } from "./lib/ref";
import { getBlobsFromFiles } from "./lib/blob";
import { Tree } from "./lib/tree";
import { Commit } from "./lib/commit";
import { getBooleanInput } from "@actions/core";
import changedFiles from "./lib/detect-changed";

export default async function run(): Promise<void> {
  try {
    // Get repo
    const repo = new Repo(process.env.GITHUB_REPOSITORY);
    await repo.load();

    // Get inputs and changed files
    const detectChanged = getBooleanInput("detect-changed");

    const files = detectChanged ? await changedFiles() : getInput("files");
    if (!files) {
      core.info("Files to be committed are not specified.");
      return;
    }

    const baseDir = getInput("workspace", {
      default: process.env.GITHUB_WORKSPACE,
    });
    const commitMessage = getInput("commit-message");

    // Load ref details
    const ref = new Ref(
      repo,
      getInput("ref", { default: repo.defaultBranchRef })
    );
    await ref.load();

    // Expand files to an array of "blobs", which will be created on GitHub via the create blob API
    const blobs = getBlobsFromFiles(repo, files, { baseDir });
    core.debug(
      `Received ${blobs.length} blob${
        blobs.length === 1 ? "" : "s"
      }: ${blobs.map((blob) => blob.absoluteFilePath).join(", ")}`
    );

    // Create a tree
    const tree: Tree = new Tree(repo, blobs, ref.treeOid);

    // Create commit
    const commit: Commit = new Commit(repo, tree, commitMessage, [
      ref.commitOid,
    ]);
    await commit.save();

    // Set commit sha output
    core.setOutput("commit-sha", commit.sha);

    // Update ref to point at new commit sha
    await ref.update(commit.sha);
  } catch (e) {
    core.setFailed(e);
  }
}

run();
