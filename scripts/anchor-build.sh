#!/bin/bash

set -e

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# sync program address
anchor keys sync

# compile the program
anchor build

# Copy program type and IDL to app/src/idl/magicplace.ts

# type is at target/types/magicplace.ts
# IDL is at target/idl/magicplace.json

# copy type
cp "$PROJECT_ROOT/target/types/magicplace.ts" "$PROJECT_ROOT/app/src/idl/magicplace.ts"

# copy IDL
cp "$PROJECT_ROOT/target/idl/magicplace.json" "$PROJECT_ROOT/app/src/idl/magicplace.json"
