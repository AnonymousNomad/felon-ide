"""FSI_FELON model plugin — Q-NFRE engine, Chimera, Superimposition, Psychomode."""

import os, sys, json, time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from plugins.base import ModelPlugin

FSI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class FelonPlugin(ModelPlugin):
    name = "felon"
    version = "4.0"
    description = "FSI_FELON — Q-NFRE recursive intelligence engine with Chimera neural routing"

    def __init__(self):
        self.engine = None
        self.chimera = None

    def _ensure_engine(self):
        if self.engine is None:
            try:
                sys.path.insert(0, FSI_DIR)
                from quantum.engine import QNFREConfig, QNFREEngine
                self.engine = QNFREEngine(QNFREConfig.full_config())
            except Exception as e:
                return str(e)
        return None

    def _ensure_chimera(self):
        if self.chimera is None:
            try:
                sys.path.insert(0, FSI_DIR)
                from chimera.engine import ChimeraEngine
                self.chimera = ChimeraEngine()
            except Exception as e:
                return str(e)
        return None

    def on_start(self, server):
        self._ensure_engine()
        self._ensure_chimera()

    def get_info(self):
        info = super().get_info()
        if self.chimera:
            stats = self.chimera.engine_stats()
            info["chimera"] = {
                "organs": 6,
                "tasks": stats.get("total_tasks", 0),
                "accuracy": stats.get("routing_accuracy", 1.0),
            }
        if self.engine:
            info["engine"] = "loaded"
        return info

    def register_commands(self):
        return {
            "chimera": self._cmd_chimera,
            "psycho": self._cmd_psycho,
            "super": self._cmd_super,
            "felon": self._cmd_felon,
        }

    def _cmd_chimera(self, cmd, server):
        text = cmd[7:].strip() if len(cmd) > 7 else ""
        if not text:
            return ["[CHIMERA] Usage: chimera <text>"]
        err = self._ensure_chimera()
        if err or not self.chimera:
            return [f"[CHIMERA] Error: {err or 'not loaded'}"]
        result = self.chimera.route(text)
        return [
            f"[CHIMERA] Routed to: {result['routed_to']}  (score: {result['routing_score']:.2f})",
            f"[CHIMERA] Type: {result['type']} — {result['time_elapsed']:.3f}s",
        ]

    def _cmd_psycho(self, cmd, server):
        project = cmd[6:].strip() if len(cmd) > 6 else "project"
        err = self._ensure_chimera()
        if err or not self.chimera:
            return [f"[ERROR] Chimera offline: {err}"]
        result = self.chimera._psycho_mode(project)
        return result

    def _cmd_super(self, cmd, server):
        parts = cmd.lower().split()
        if len(parts) < 2:
            return ["[SUPER] Usage: super <description>"]
        err = self._ensure_chimera()
        if err or not self.chimera:
            return [f"[SUPER] Error: {err}"]
        ci = self.chimera
        rest = cmd[len("super"):].strip()
        try:
            variants = ci.superimposition.generate_variants(rest or "project", 5)
            lines = [f"[SUPER] Generated {len(variants)} variants:"]
            for v in variants:
                lines.append(f"  [{v['id']}] {v['approach']:14s} → {v['organ']:8s} ({v.get('loc', 0)} LOC)")
            lines.append("")
            lines.append("[SUPER] super use <id> | super run <id> | super status")
            return lines
        except Exception as e:
            return [f"[SUPER] Error: {e}"]

    def _cmd_felon(self, cmd, server):
        info = self.get_info()
        return [
            f"FSI_FELON v{info['version']}",
            f"  Engine: {info.get('engine', 'not loaded')}",
            f"  Chimera: {info.get('chimera', {}).get('tasks', 0)} tasks, {info.get('chimera', {}).get('accuracy', 0)*100:.0f}% accuracy",
            f"  Description: {info['description']}",
        ]

    def register_endpoints(self):
        return {
            "/api/felon/info": self._endpoint_info,
            "/api/felon/chimera": self._endpoint_chimera,
        }

    def _endpoint_info(self, body, server):
        return self.get_info()

    def _endpoint_chimera(self, body, server):
        text = body.get("text", "")
        if not text:
            return {"output": ["No input"], "error": True}
        err = self._ensure_chimera()
        if err or not self.chimera:
            return {"output": [f"Chimera error: {err}"], "error": True}
        result = self.chimera.route(text)
        return {
            "output": [
                f"Routed to: {result['routed_to']}",
                f"Score: {result['routing_score']:.2f}",
                f"Time: {result['time_elapsed']:.3f}s",
            ],
            "routed_to": result["routed_to"],
            "score": result["routing_score"],
        }
