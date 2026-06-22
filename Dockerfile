# syntax=docker/dockerfile:1.7
# Multi-stage build — targets linux/amd64 and linux/arm64 via Docker Buildx.
#
# Build-arg TARGETARCH is injected automatically by Buildx:
#   linux/amd64  → TARGETARCH=amd64
#   linux/arm64  → TARGETARCH=arm64

# ── Stage 1: rust-builder ──────────────────────────────────────────────────────
# Compiles the soroban-xdr-decode native N-API addon for the target platform.
# Kept in its own stage so the Rust toolchain (~900 MB) never reaches the
# final image.
FROM node:20-bookworm-slim AS rust-builder

# Receive the platform Buildx is building for.
ARG TARGETARCH

# build-essential      — gcc/g++/make for the host (amd64) linker.
# gcc-aarch64-linux-gnu — cross-linker required when targeting arm64 on an
#                         amd64 runner (QEMU emulation is too slow for Rust).
# libssl-dev / pkg-config — pulled in by some crate build scripts.
# curl                 — used by the rustup installer.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc-aarch64-linux-gnu \
        libssl-dev \
        pkg-config \
        curl \
    && rm -rf /var/lib/apt/lists/*

# ── Rust toolchain ────────────────────────────────────────────────────────────
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --profile minimal

# ── Select Rust target triple based on TARGETARCH ─────────────────────────────
# Buildx sets TARGETARCH to "amd64" or "arm64".  Map those to the Rust
# target triples used in the napi build command.
RUN case "$TARGETARCH" in \
      amd64) echo "x86_64-unknown-linux-gnu"   > /rust-target ;; \
      arm64) echo "aarch64-unknown-linux-gnu"  > /rust-target ;; \
      *)     echo "Unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
    esac && \
    rustup target add "$(cat /rust-target)"

# ── Cross-linker environment for aarch64 ─────────────────────────────────────
# Cargo needs to know which linker to use when cross-compiling for arm64 on an
# amd64 host.  This env var is ignored when building natively.
ENV CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc

WORKDIR /addon

# Copy only the files needed to compile the Rust crate so Docker can cache
# the dependency-download layer independently from source changes.
COPY native/soroban-xdr-decode/Cargo.toml    ./Cargo.toml
COPY native/soroban-xdr-decode/Cargo.lock    ./Cargo.lock
COPY native/soroban-xdr-decode/build.rs      ./build.rs
COPY native/soroban-xdr-decode/src           ./src
COPY native/soroban-xdr-decode/package.json  ./package.json
COPY native/soroban-xdr-decode/.cargo        ./.cargo

# Install @napi-rs/cli — pin the exact version to match package.json.
# --ignore-scripts prevents any post-install native compilation here.
RUN npm install --save-dev @napi-rs/cli@2.18.4 --ignore-scripts

# Build the release .node binary for the detected target.
RUN RUST_TARGET="$(cat /rust-target)" && \
    npx napi build --platform --release --target "$RUST_TARGET"

# ── Stage 2: deps ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --ignore-scripts

# ── Stage 3: builder ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Copy the prebuilt .node binary produced in rust-builder.
# napi-rs outputs the binary as <crate-name>.linux-<arch>-gnu.node or similar;
# the glob captures all .node files regardless of the exact suffix.
COPY --from=rust-builder /addon/*.node ./native/soroban-xdr-decode/

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build && \
    npx tsc --project tsconfig.server.json

# ── Stage 4: runner ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# libc6-compat + gcompat: required to dlopen a glibc-linked .node binary
# inside a musl-based Alpine container.
RUN apk add --no-cache libc6-compat gcompat

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next          ./.next
COPY --from=builder --chown=nextjs:nodejs /app/.server-dist   ./.server-dist
COPY --from=builder --chown=nextjs:nodejs /app/public         ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json   ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json ./package-lock.json

# Carry the .node binary through to the runtime image.
COPY --from=builder --chown=nextjs:nodejs /app/native/soroban-xdr-decode/*.node \
                                          ./native/soroban-xdr-decode/

RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", ".server-dist/server.js"]
