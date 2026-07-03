"""
IDE Model Service — loads trained FsiDeepCore checkpoint for inference.
Lazy-loads torch and deep learning modules so server starts fast.
"""
import os, sys, json, glob, time

CORE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CORE)
sys.path.insert(0, os.path.dirname(CORE))
sys.path.insert(0, '/tmp/opencode/snca')

CHECKPOINT_DIR = "/tmp/fsi_felon/checkpoints"
CKPT_PATTERN = os.path.join(CHECKPOINT_DIR, "feloncore_step*.pt")

# Lazy imports — resolved in _load()
_torch = None
_FsiDeepCore = None
_SNCACfg = None
_SNCATokenizer = None

def _lazy_import():
    global _torch, _FsiDeepCore, _SNCACfg, _SNCATokenizer
    if _torch is None:
        import torch as _torch
    if _FsiDeepCore is None:
        from fsi_deep_core import FsiDeepCore as _FsiDeepCore
    if _SNCACfg is None:
        from snca_config import SNCACfg as _SNCACfg
    if _SNCATokenizer is None:
        from snca_tokenizer import SNCATokenizer as _SNCATokenizer
    return _torch, _FsiDeepCore, _SNCACfg, _SNCATokenizer

class IdeModelService:
    def __init__(self, lazy=True):
        self.model = None
        self.tokenizer = None
        self.cfg = None
        self.step = 0
        self.loaded = False
        self.load_error = None
        if not lazy:
            self._load()

    def ensure_loaded(self):
        if not self.loaded and not self.load_error:
            self._load()
        return self.loaded

    def _load(self):
        try:
            torch, FsiDeepCore, SNCACfg, SNCATokenizer = _lazy_import()
            self.cfg = SNCACfg()
            self.tokenizer = SNCATokenizer()
            self.model = FsiDeepCore(
                vocab_size=self.cfg.vocab_size, dim=self.cfg.d_model,
                n_heads=self.cfg.n_heads, n_layers=self.cfg.n_layers,
                ffn_hidden=self.cfg.d_ff, max_len=self.cfg.max_len,
                window=self.cfg.local_window, dropout=0.0,
                n_nanobots=self.cfg.n_nanobots
            )
            latest = sorted(glob.glob(CKPT_PATTERN))
            if latest:
                d = torch.load(latest[-1], map_location='cpu', weights_only=True)
                self.model.load_state_dict(d['model_state'], strict=True)
                self.step = d.get('step', 0)
                self.loaded = True
            else:
                self.load_error = "No checkpoints found"
        except Exception as e:
            self.load_error = str(e)

    def infer(self, prompt, max_new=128, temperature=0.7, top_k=40, mode='plan'):
        if not self.ensure_loaded():
            return {"error": self.load_error or "Model not loaded"}
        try:
            torch, _, _, _ = _lazy_import()
            self.model.eval()
            ids = self.tokenizer.encode(prompt, bos=True, eos=False)
            if not ids:
                return {"error": "Empty tokenization"}
            inp = torch.tensor([ids[:1024]], dtype=torch.long)
            out = self.model.generate(
                inp, max_new=max_new, temperature=temperature,
                top_k=top_k, mode=mode, territory_idx=0
            )
            generated = out[0].tolist()
            prompt_len = len(ids)
            new_tokens = generated[prompt_len:] if len(generated) > prompt_len else generated
            text = self.tokenizer.decode(new_tokens, skip_special=True)
            return {"output": text.strip(), "tokens": len(new_tokens), "step": self.step}
        except Exception as e:
            return {"error": str(e)}

    def status(self):
        return {
            "loaded": self.loaded,
            "step": self.step,
            "error": self.load_error,
            "checkpoint": sorted(glob.glob(CKPT_PATTERN))[-1] if glob.glob(CKPT_PATTERN) else None,
        }
