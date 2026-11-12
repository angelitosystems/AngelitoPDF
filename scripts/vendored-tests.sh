#!/usr/bin/env bash
# Runs the upstream unit tests of the vendored crates (vendor/*) with our patches applied
# to each other. They are not members of the root workspace (that would change its
# Cargo.lock and `cargo test --workspace`), so build a throwaway workspace around copies.
# Usage: scripts/vendored-tests.sh [extra cargo test args, e.g. -- --test-threads=4]
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
ws="$root/target/vendored-ws"
rm -rf "$ws" && mkdir -p "$ws"
crates=(blitz-dom blitz-html fulgur-blitz)
for c in "${crates[@]}"; do cp -r "$root/vendor/$c" "$ws/$c"; done
cp "$root/Cargo.lock" "$ws/Cargo.lock"   # same versions as the shipped build
{
  echo '[workspace]'
  echo 'resolver = "3"'
  echo 'members = ["blitz-dom", "blitz-html", "fulgur-blitz"]'
  echo '[patch.crates-io]'
  for c in "${crates[@]}"; do echo "$c = { path = \"$c\" }"; done
} > "$ws/Cargo.toml"
export CARGO_TARGET_DIR="$root/target/vendored"
cd "$ws"
# Fail unless fulgur-blitz resolves blitz-dom/blitz-html to the copies here, not crates.io.
tree="$(cargo tree -p fulgur-blitz -e normal --prefix none)"
blitz="$(grep -E "^blitz-(dom|html) " <<<"$tree" || true)"
if [ -z "$blitz" ] || grep -v "vendored-ws" <<<"$blitz"; then
  echo "fulgur-blitz is not using the vendored blitz-dom/blitz-html" >&2; exit 1
fi
status=0
for c in "${crates[@]}"; do
  echo "=== cargo test -p $c --lib"
  cargo test -p "$c" --lib "$@" || status=1
done
exit $status
