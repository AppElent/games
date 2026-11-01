#!/usr/bin/env node
// Lets an EAS builder install the private @appelent packages: appends the
// GitHub Packages token from NODE_AUTH_TOKEN (an EAS secret, see
// env.manifest.ts) to ~/.npmrc. CI does the same in ci.yml. Never prints it.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const npmrc = join(homedir(), ".npmrc");
const token = process.env.NODE_AUTH_TOKEN;
const line = "//npm.pkg.github.com/:_authToken=";

if (!token) {
	console.error("npm-auth: NODE_AUTH_TOKEN is not set; @appelent packages will fail to install.");
	process.exit(1);
}
if (!existsSync(npmrc) || !readFileSync(npmrc, "utf8").includes(line)) {
	appendFileSync(npmrc, `\n${line}${token}\n`);
}
console.log("npm-auth: GitHub Packages auth configured.");
