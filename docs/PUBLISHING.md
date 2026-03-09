# Publishing Guide

This repository now has two Python distributions:

- `codex-bridge`: the Python-first local broker runtime in [`/broker`](../broker/README.md)
- `codex-bridge-sdk`: the Python SDK client in [`/python`](../python/README.md)

## Local Build

From the repository root:

```bash
npm run package:broker
npm run package:sdk
```

These commands require:

```bash
python3 -m pip install build
```

## Broker Package

Broker source:

- [`broker/pyproject.toml`](../broker/pyproject.toml)
- [`broker/src/codex_bridge_broker`](../broker/src/codex_bridge_broker)

Install locally:

```bash
pip install ./broker
```

Install with secure storage support:

```bash
pip install './broker[secure]'
```

Installed CLI entrypoints:

- `codex-bridge`
- `codex-bridge-broker`

## SDK Package

SDK source:

- [`python/pyproject.toml`](../python/pyproject.toml)
- [`python/src/codex_bridge`](../python/src/codex_bridge)

Install locally:

```bash
pip install ./python
```

Published package name:

```bash
pip install codex-bridge-sdk
```

## Release Steps

1. Run validation:

```bash
npm run build
npm run test:python
npm run test:python:broker
```

2. Build both Python distributions:

```bash
npm run package:broker
npm run package:sdk
```

3. Upload with `twine`:

```bash
python3 -m pip install twine
python3 -m twine upload broker/dist/*
python3 -m twine upload python/dist/*
```

## Notes

- The broker is the main product package.
- The SDK is published separately to keep the runtime and client concerns clean.
- The Node runtime remains in the repository only as a transitional compatibility path.
