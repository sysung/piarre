FROM node:24-bookworm-slim AS extension
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/vscode/package.json apps/vscode/package.json
COPY packages/core/package.json packages/core/package.json
RUN npm ci
COPY . .
RUN npm run build && cd apps/vscode && npx vsce package --no-dependencies --out /tmp/piarre.vsix

FROM node:24-bookworm-slim
ARG TARGETARCH
ARG VSCODE_VERSION=1.144.0
ARG CODEX_VERSION=0.164.0
ENV DEBIAN_FRONTEND=noninteractive DISPLAY=:99 \
    CODEX_HOME=/home/node/.codex \
    PIARRE_USER_DATA=/home/node/.config/piarre-code
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git python3 tini xvfb x11-utils x11vnc novnc websockify \
    openbox dbus-x11 xterm fonts-liberation libasound2 libgbm1 \
    && case "$TARGETARCH" in amd64) code_arch=x64 ;; arm64) code_arch=arm64 ;; *) exit 1 ;; esac \
    && curl --fail --location --retry 3 "https://update.code.visualstudio.com/${VSCODE_VERSION}/linux-deb-${code_arch}/stable" -o /tmp/code.deb \
    && echo 'code code/add-microsoft-repo boolean false' | debconf-set-selections \
    && apt-get install -y --no-install-recommends /tmp/code.deb \
    && npm install --global "@openai/codex@${CODEX_VERSION}" \
    && rm -rf /var/lib/apt/lists/* /tmp/code.deb
COPY --from=extension /tmp/piarre.vsix /opt/piarre/piarre.vsix
RUN code --no-sandbox --user-data-dir /tmp/code-install --extensions-dir /opt/piarre/extensions \
      --install-extension /opt/piarre/piarre.vsix --force \
    && rm -rf /tmp/code-install \
    && mkdir -p /home/node/.codex /home/node/.config/piarre-code /workspace \
    && chown -R node:node /home/node /opt/piarre
COPY docker/entrypoint.sh /usr/local/bin/piarre-desktop
COPY docker/settings.json /opt/piarre/settings.json
COPY docker/index.html /usr/share/novnc/index.html
RUN chmod +x /usr/local/bin/piarre-desktop
USER node
WORKDIR /workspace
EXPOSE 6080
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
    CMD curl --fail --silent http://127.0.0.1:6080/vnc.html >/dev/null && xdpyinfo -display :99 >/dev/null 2>&1
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/piarre-desktop"]
