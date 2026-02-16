const args = process.argv.slice(2);

const readArg = (name) => {
  const prefix = `--${name}=`;
  const fromInline = args.find((arg) => arg.startsWith(prefix));
  if (fromInline) {
    return fromInline.slice(prefix.length);
  }

  const index = args.findIndex((arg) => arg === `--${name}`);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }

  return "";
};

const from = readArg("from");
const to = readArg("to");

if (!from || !to) {
  console.error("Usage: npm --workspace apps/landing-engine run radiography:diff -- --from=<run_id> --to=<run_id>");
  process.exit(1);
}

const port = process.env.PORT ?? "3000";
const baseUrl = process.env.RADIOGRAPHY_API_BASE ?? `http://localhost:${port}`;
const endpoint = new URL("/api/radiography/runlog/diff", baseUrl);
endpoint.searchParams.set("from", from);
endpoint.searchParams.set("to", to);

const response = await fetch(endpoint, { cache: "no-store" });
const body = await response.json();

if (!response.ok || body?.ok !== true) {
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(`Diff ${body.from} -> ${body.to}`);
console.log(
  `Gating: ${body.changes.gating.from.status} (${body.changes.gating.from.core_percent}) -> ${body.changes.gating.to.status} (${body.changes.gating.to.core_percent})`
);
console.log(
  `Blockers +${body.changes.blockers.added.length}/-${body.changes.blockers.removed.length}`
);
console.log(
  `Patch ops delta: ${body.changes.patch_ops_count.delta} | Coverage delta: ${body.changes.provenance_coverage_percent.delta}`
);
console.log(
  `Lint delta: hard ${body.changes.lint.hard_delta}, warn ${body.changes.lint.warn_delta}, items ${body.changes.lint.items_delta}`
);
console.log(
  `Capabilities +${body.changes.capabilities_changed.added.length}/-${body.changes.capabilities_changed.removed.length} | Seed hosts +${body.changes.seed_hosts_changed.added.length}/-${body.changes.seed_hosts_changed.removed.length}`
);
