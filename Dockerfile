FROM oven/bun:1.3.14

ARG TARGETARCH
ENV RUNNING_IN_DOCKER=true

USER root

COPY apps/server/build/out/bullshark-linux-x64 /tmp/bullshark-linux-x64
COPY apps/server/build/out/bullshark-linux-arm64 /tmp/bullshark-linux-arm64

RUN set -eux; \
    case "$TARGETARCH" in \
      amd64)  cp /tmp/bullshark-linux-x64 /sharkord ;; \
      arm64)  cp /tmp/bullshark-linux-arm64 /sharkord ;; \
      *) echo "Unsupported arch: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    chmod +x /sharkord; \
    chown bun:bun /sharkord; \
    rm -rf /tmp/bullshark-linux-*

RUN mkdir -p /home/bun/.config/sharkord && \
    chown -R bun:bun /home/bun/.config

COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /home/bun

ENTRYPOINT ["/entrypoint.sh"]