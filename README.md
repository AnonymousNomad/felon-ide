# FELON IDE

**Universal Model Platform — Train, chain, deploy any model. Replace VS Code and GitHub.**

A self-contained IDE where any machine learning model can be loaded, trained, fine-tuned, distilled, chained with other models, compiled into Android APKs, and shared over a decentralized P2P network.

## Why This Exists

VS Code + GitHub dominate development, but they:
- Have no native model training or fine-tuning
- Cannot compile Android APKs
- Require centralized servers (GitHub)
- Send telemetry and track usage
- Have no truth-seeking or cross-domain investigation tools

FELON IDE solves all of this in one lightweight, local-first package.

## Panels

| Panel | Purpose |
|-------|---------|
| **Workshop** | Code editor + Model playground. Write code, load models, train, fine-tune, distill knowledge between models, chain teacher→student training, analyze model internals |
| **Deep** | Terminal and chat interface. All commands available: build, test, mesh operations, White Rabbit truth-seeking, chimera routing, stats, help |
| **Mesh** | Decentralized P2P repo network. Init, publish, clone, push, pull repos across nodes. Replace GitHub with a censorship-resistant, offline-capable network |
| **Device** | Android APK builder. Generate, build, verify, install, and run Android apps from the IDE |

## Model Features

- **Train** any model with custom parameters (LR, epochs, batch size)
- **Fine-tune** pre-trained models on your data
- **Distill** knowledge from large models to small ones
- **Chain** teacher→student training pipelines
- **Analyze** model architecture (layers, parameters, attention heads)
- **Load** from local files (.pt, .bin, .gguf, .safetensors) or Hugging Face
- **Share** trained models over the Mesh network

## Plugin System

Any model can plug into the IDE. Create a plugin in `plugins/`:

```python
from plugins.base import ModelPlugin

class MyModelPlugin(ModelPlugin):
    name = "my-model"
    version = "1.0"
    description = "Custom model plugin"

    def register_commands(self):
        return {"mycmd": self._handle_mycmd}

    def register_endpoints(self):
        return {"/api/my-model/action": self._endpoint}
```

Drop it in `plugins/` and restart — the IDE automatically discovers it.

## Quick Start

```bash
python3 server.py
```

Opens two ports:
- **`http://localhost:8080`** — IDE frontend
- **`http://localhost:9090`** — API backend

## Architecture

```
felon-ide/
├── server.py          # Universal server (static + API + plugin loader)
├── index.html         # IDE frontend
├── style.css          # Underwater bioluminescent theme
├── app.js             # Client-side logic
├── plugins/
│   ├── base.py        # Model plugin interface
│   └── felon.py       # FSI_FELON plugin (Q-NFRE engine, Chimera)
├── workspace/         # User code and model files
└── mesh_db.json       # P2P network state
```

Core services (mesh P2P, Android compiler, White Rabbit, sandbox) are loaded from the parent project at runtime. The server gracefully degrades if a service is unavailable.

## Why "For the Ghost"

White Rabbit mode operates "for the ghost" — meaning it's a tool for the model itself to question its own beliefs, find discrepancies in its training data, and challenge its assumptions. It is not for everyone and requires explicit user consent.

## License

MIT
