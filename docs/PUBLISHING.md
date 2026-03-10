# Publishing Guide

This repository has two Python distributions:

- `codex-bridge`: the broker runtime in the repository root
- `codex-bridge-sdk`: the Python SDK client in [`/sdk`](../sdk/README.md)

## Local Build

From the repository root:

```bash
python3 -m pip install build
```

Build the broker:

```bash
python3 -m build .
```

Build the SDK:

```bash
python3 -m build sdk
```

## Broker Package

Broker source:

- [`pyproject.toml`](../pyproject.toml)
- [`src/codex_bridge`](../src/codex_bridge)

Install locally:

```bash
pip install .
```

Install with secure storage support:

```bash
pip install '.[secure]'
```

Installed CLI entrypoints:

- `codex-bridge`

## SDK Package

SDK source:

- [`sdk/pyproject.toml`](../sdk/pyproject.toml)
- [`sdk/src/codex_bridge_sdk`](../sdk/src/codex_bridge_sdk)

Install locally:

```bash
pip install ./sdk
```

Published package name:

```bash
pip install codex-bridge-sdk
```

## Release Steps

1. Run validation:

```bash
PYTHONPATH=src python -m unittest discover -s tests -p 'test_*.py'
PYTHONPATH=sdk/src python -m unittest discover -s sdk/tests -p 'test_*.py'
```

2. Build both Python distributions:

```bash
python3 -m build .
python3 -m build sdk
```

3. Upload with `twine`:

```bash
python3 -m pip install twine
python3 -m twine upload dist/*
python3 -m twine upload sdk/dist/*
```

## Notes

- The broker is the main product package.
- The SDK is published separately to keep runtime and client concerns clean.
