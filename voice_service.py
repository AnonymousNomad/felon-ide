"""
Voice Service — STT/TTS pipeline for open-source voice assistant.
Whisper for speech-to-text, Piper for text-to-speech.
All local, no cloud dependency.
"""
import os, sys, json, io, tempfile, struct, wave, threading, time, re

CORE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CORE)

WHISPER_MODEL = "openai/whisper-tiny"
PIPER_MODEL = "piper-voice-low"  # placeholder

_stt_pipeline = None
_tts_model = None
_stt_lock = threading.Lock()
_tts_lock = threading.Lock()


def _get_stt():
    global _stt_pipeline
    if _stt_pipeline is None:
        with _stt_lock:
            if _stt_pipeline is None:
                try:
                    from transformers import WhisperProcessor, WhisperForConditionalGeneration
                    import torch
                    processor = WhisperProcessor.from_pretrained(WHISPER_MODEL)
                    model = WhisperForConditionalGeneration.from_pretrained(WHISPER_MODEL)
                    model.eval()
                    _stt_pipeline = (processor, model, torch)
                except Exception as e:
                    return None, str(e)
    return _stt_pipeline, None


def _get_tts():
    global _tts_model
    if _tts_model is None:
        with _tts_lock:
            if _tts_model is None:
                try:
                    from piper import PiperVoice
                    model_path = os.path.join(CORE, "models", "piper", "voice.onnx")
                    if os.path.exists(model_path):
                        _tts_model = PiperVoice.load(model_path)
                    else:
                        return None, "Piper model not found at " + model_path
                except ImportError:
                    return None, "piper-tts not installed (pip install piper-tts)"
                except Exception as e:
                    return None, str(e)
    return _tts_model, None


def transcribe(audio_bytes, sample_rate=16000):
    """Transcribe audio bytes to text using Whisper tiny."""
    pipeline, err = _get_stt()
    if err:
        return {"error": err}
    processor, model, torch = pipeline
    try:
        import numpy as np
        audio = np.frombuffer(audio_bytes, dtype=np.float32).reshape(-1)
        input_features = processor(audio, sampling_rate=sample_rate, return_tensors="pt").input_features
        with torch.no_grad():
            predicted_ids = model.generate(input_features)
        text = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
        return {"text": text.strip(), "success": True}
    except Exception as e:
        return {"error": str(e)}


def synthesize(text, voice_model=None):
    """Synthesize text to speech using Piper TTS."""
    model, err = _get_tts()
    if err:
        return {"error": err}
    try:
        wav_bytes = io.BytesIO()
        with wave.open(wav_bytes, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(22050)
            audio = model.synthesize(text)
            wf.writeframes(audio.tobytes())
        return {"audio": wav_bytes.getvalue().hex(), "format": "wav", "sample_rate": 22050, "success": True}
    except Exception as e:
        return {"error": str(e)}


COMMANDS = [
    (r"^(remind|reminder|alarm|timer|set\s+(a|an)\s+(timer|reminder|alarm))", "reminder"),
    (r"^(set\s+(a|an)\s+)?(timer|alarm)(\s+for|\s+to)", "reminder"),
    (r"^(turn|switch)\s+(on|off)\s+(the\s+)?\w+", "smart_home"),
    (r"^(set|dim|brighten)\s+(the\s+)?(lights?|thermostat|temperature|volume|brightness)", "smart_home"),
    (r"^(play|pause|skip|stop|next|previous)\s+\w+", "media"),
    (r"^(volume|music|song|playlist|turn\s+(up|down)\s+(the\s+)?volume)", "media"),
    (r"^(call|text|message|email|send\s+(a\s+)?)", "communication"),
    (r"^(open|launch|start|run)\s+\w+", "launch"),
    (r"^(tell\s+(me\s+)?a\s+(joke|story))", "entertain"),
    (r"^(joke|story|funny|make\s+me\s+laugh)", "entertain"),
    (r"^(define|explain|what\s+(is|does|are)\s+(the\s+)?(meaning|definition))", "knowledge"),
    (r"^(translate|say\s+(in|this)\s+\w+)", "translate"),
    (r"^(shutdown|reboot|restart|sleep|power\s+(off|down))", "system"),
    (r"^(what|who|which|where|when)\s+(is|are|was|were|does|do|did|can|will)", "knowledge"),
    (r"^(what|who|which|where|when)\s+\w+\s+(is|are|was|were)", "knowledge"),
    (r"^(how\s+(do|can|to|is|does|did|would|will|are))\s", "ask"),
    (r"^(why\s+(is|does|did|would|are|do|can|will))\s", "ask"),
    (r"^(what'?s?|tell\s+me)\s", "ask"),
    (r"^(what|who|which|where|when|why|how)\s", "ask"),
]


def classify_intent(text):
    """Classify voice command intent from transcribed text."""
    text_lower = text.lower().strip()
    for pattern, intent in COMMANDS:
        if re.search(pattern, text_lower):
            return intent
    if re.search(r"^(what|who|which|where|when|why|how|tell|is|are|can|will|do|does)\s", text_lower):
        return "ask"
    return "chat"


def process_voice_command(text, model_service=None):
    """Process a voice command through the FELON model."""
    intent = classify_intent(text)
    prompt_map = {
        "smart_home": f"Voice command: {text}\nInterpret this smart home command and generate the device control code.",
        "knowledge": f"Voice query: {text}\nAnswer concisely from available knowledge.",
        "media": f"Voice command: {text}\nHandle this media playback request.",
        "launch": f"Voice command: {text}\nGenerate the launch/open command.",
        "reminder": f"Voice command: {text}\nCreate a reminder for this.",
        "chat": f"User said: {text}\nRespond helpfully and concisely.",
    }
    prompt = prompt_map.get(intent, f"User said: {text}\nRespond:")
    result = {"intent": intent, "text": text}

    if model_service:
        try:
            r = model_service.infer(prompt, max_new=64, temperature=0.7)
            result["response"] = r.get("output", "")
            result["model_output"] = True
        except Exception as e:
            result["response"] = f"Model unavailable: {e}"
            result["model_output"] = False
    else:
        result["response"] = f"[{intent.upper()}] Command received: {text}"

    return result


class VoiceService:
    def __init__(self, model_service=None):
        self.model_service = model_service
        self.supported = {
            "stt": False,
            "tts": False,
            "wake_word": False,
        }
        self._check_capabilities()

    def _check_capabilities(self):
        try:
            from transformers import WhisperProcessor
            self.supported["stt"] = True
        except ImportError:
            self.supported["stt"] = False
        try:
            import piper
            self.supported["tts"] = True
        except ImportError:
            self.supported["tts"] = False

    def status(self):
        return {
            "supported": self.supported,
            "wake_word_model": "porcupine" if os.path.exists("/tmp/porcupine.ppn") else None,
            "intent_classes": list(COMMANDS.values()),
        }
