# Container image for triage pipeline sandboxes. Pin the base image to the
# exact @cloudflare/sandbox SDK version in package.json.
FROM docker.io/cloudflare/sandbox:0.12.5

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		git ripgrep curl ca-certificates build-essential pkg-config python3 clang cmake \
	&& rm -rf /var/lib/apt/lists/*

# Package manager for reproducing/building target repositories.
RUN npm install -g corepack@0.34.6 @ast-grep/cli@0.44.0 \
	&& corepack enable \
	&& corepack prepare pnpm@12.7.0 --activate

ENV INSTA_REQUIRE_FULL_MATCH=1

# Rust support, for repositories like @astrojs/compiler-rs.
#
# rustup is installed with NO default toolchain: shipping one would add ~1.5GB
# to every cold-start image pull (including for repos that never touch Rust)
# and would drift from whatever version the target repo pins. Instead the
# cargo/rustc shims resolve the toolchain from the checkout's
# rust-toolchain.toml on first invocation, so each repo gets exactly the
# version it asks for. build-essential above supplies the `cc` linker that
# rustc needs.
#
# CARGO_HOME/RUSTUP_HOME are world-writable because that first-invocation
# install happens at runtime, as the sandbox user, not at build time.
ENV RUSTUP_HOME=/usr/local/rustup \
	CARGO_HOME=/usr/local/cargo \
	PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
	| sh -s -- -y --no-modify-path --profile minimal --default-toolchain none \
	&& chmod -R a+w "$RUSTUP_HOME" "$CARGO_HOME"

# Oxc's Rust verification tools are shared by every triage container. Remove
# the build toolchain after installation; the target checkout selects its own.
RUN rustup toolchain install stable --profile minimal \
	&& cargo +stable install --locked just cargo-insta cargo-shear@1.13.1 \
	&& rustup toolchain uninstall stable \
	&& chmod -R a+w "$RUSTUP_HOME" "$CARGO_HOME"

# Adversary agent commands run as this user while the sandbox control plane
# remains root for the other workflows that share this image.
RUN useradd --create-home --shell /bin/bash sandbox-agent

EXPOSE 8080
