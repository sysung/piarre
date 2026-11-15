# syntax=docker/dockerfile:1
FROM rust:1.97.1-slim-bookworm AS build
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/build/target \
    cargo build --locked --release && cp target/release/piarre /usr/local/bin/piarre

FROM debian:bookworm-slim AS runtime
COPY --from=build /usr/local/bin/piarre /usr/local/bin/piarre
USER 10001:10001
WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/piarre"]
