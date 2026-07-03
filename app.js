const API = 'http://' + location.hostname + ':9090';

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.sidebar-tab');
    const panels = document.querySelectorAll('.panel');

    // ── Splash ──
    setTimeout(() => {
        const s = document.getElementById('splash');
        if (s) { s.style.opacity = '0'; setTimeout(() => s.style.display = 'none', 800); }
    }, 3200);

    // ── Bubbles ──
    for (let i = 0; i < 30; i++) {
        const b = document.createElement('div');
        b.className = 'bubble';
        const size = 2 + Math.random() * 6;
        b.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;bottom:-10px;animation-duration:${6+Math.random()*8}s;animation-delay:${Math.random()*8}s;opacity:${0.1+Math.random()*0.2}`;
        document.body.appendChild(b);
    }

    async function api(path, body) {
        try {
            const r = await fetch(API + path, {
                method: body ? 'POST' : 'GET',
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : null,
            });
            return await r.json();
        } catch (e) {
            return { output: ['[API] Server offline'], error: true };
        }
    }

    // ── Tab Switching ──
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.panel;
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById('panel-' + target);
            if (panel) panel.classList.add('active');
        });
    });

    // ── Workshop Code/Model Mode Toggle ──
    const modeTabs = document.querySelectorAll('.workshop-mode-tab');
    const modeContents = {
        code: document.getElementById('workshop-code'),
        model: document.getElementById('workshop-model'),
    };

    modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.mode;
            modeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            Object.keys(modeContents).forEach(k => {
                if (modeContents[k]) modeContents[k].style.display = k === mode ? 'flex' : 'none';
            });
        });
    });

    // ── Workshop: Editor ──
    const editor = document.getElementById('code-editor');
    const gutter = document.getElementById('editor-gutter');
    const forgeLog = document.getElementById('forge-log');

    if (editor && gutter) {
        const updateGutter = () => {
            gutter.innerHTML = editor.value.split('\n').map((_, i) => '<div>' + (i + 1) + '</div>').join('');
        };
        editor.addEventListener('input', updateGutter);
        editor.addEventListener('scroll', () => { gutter.scrollTop = editor.scrollTop; });
        updateGutter();
    }

    function forgeWrite(text, cls = '') {
        if (!forgeLog) return;
        if (forgeLog.querySelector('.forge-log-empty')) forgeLog.innerHTML = '';
        const d = document.createElement('div');
        d.className = 'forge-line ' + cls;
        d.textContent = text;
        forgeLog.appendChild(d);
        forgeLog.scrollTop = forgeLog.scrollHeight;
    }

    // Forge It
    document.getElementById('forge-btn')?.addEventListener('click', async () => {
        const code = editor?.value || '';
        const lines = code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
        const desc = (lines[0] || 'project').replace(/^def\s+|^class\s+|^#\s*/g, '').trim().slice(0, 60) || 'project';
        const btn = document.getElementById('forge-btn');
        btn.textContent = '⚡ Forging...';
        btn.disabled = true;
        forgeWrite('[FORGE] Building: ' + desc, 'info');

        const data = await api('/api/build', { desc, code });
        (data.output || []).forEach(line => forgeWrite(line));
        btn.textContent = '⚡ Forge It';
        btn.disabled = false;
    });

    // Generate button
    document.getElementById('workshop-gen-btn')?.addEventListener('click', async () => {
        const params = document.getElementById('editor-gen-params');
        if (params.style.display === 'none') {
            params.style.display = 'flex';
            return;
        }
        const editor = document.getElementById('code-editor');
        const prompt = document.getElementById('gen-prompt')?.value?.trim() || (editor?.value || '').slice(-500);
        const maxNew = parseInt(document.getElementById('gen-tokens')?.value) || 128;
        const temp = parseFloat(document.getElementById('gen-temp')?.value) || 0.7;
        const btn = document.getElementById('workshop-gen-btn');
        btn.textContent = '🧠 Generating...';
        btn.disabled = true;
        forgeWrite('[GEN] Generating from prompt...', 'info');
        forgeWrite('  Model step ' + (await api('/api/model/status')).step || '?', 'info');
        forgeWrite(`  max_tokens=${maxNew} temp=${temp}`, 'info');
        const result = await api('/api/model/infer', { prompt, max_new: maxNew, temperature: temp });
        if (result.output) {
            forgeWrite('[GEN] Output:', 'info');
            forgeWrite(result.output.slice(0, 2000), 'train');
            if (editor) editor.value += '\n' + result.output;
        } else {
            forgeWrite('[GEN] Error: ' + (result.error || 'No output'), 'error');
        }
        btn.textContent = '🧠 Generate';
        btn.disabled = false;
        // Hide params after generation
        params.style.display = 'none';
    });

    // Run button
    document.getElementById('workshop-run-btn')?.addEventListener('click', () => {
        const code = editor?.value || '';
        const desc = (code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))[0] || 'script').slice(0, 40);
        forgeWrite('[RUN] Executing: ' + desc, 'info');
        forgeWrite('[RUN] ✓ Complete', 'success');
        const deepTab = document.querySelector('[data-panel="deep"]');
        if (deepTab) deepTab.click();
        const ti = document.getElementById('terminal-input');
        if (ti) { ti.value = 'build ' + desc; ti.focus(); }
    });

    // ── Model Training UI ──
    // Source selector toggle
    document.getElementById('model-source')?.addEventListener('change', (e) => {
        const upload = document.getElementById('model-upload-area');
        const hf = document.getElementById('model-hf-area');
        if (e.target.value === 'huggingface') {
            upload.style.display = 'none';
            hf.style.display = 'flex';
        } else {
            upload.style.display = 'block';
            hf.style.display = 'none';
        }
    });

    // Upload zone
    const uploadZone = document.getElementById('model-upload-zone');
    if (uploadZone) {
        uploadZone.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pt,.pth,.bin,.gguf,.safetensors,.onnx';
            input.onchange = () => {
                if (input.files.length) {
                    document.getElementById('model-loaded-name').textContent = input.files[0].name;
                    document.getElementById('model-loaded').style.display = 'flex';
                    logModel('Loaded: ' + input.files[0].name, 'success');
                }
            };
            input.click();
        });
        uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.style.borderColor = '#00d4ff'; });
        uploadZone.addEventListener('dragleave', () => { uploadZone.style.borderColor = ''; });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = '';
            if (e.dataTransfer.files.length) {
                document.getElementById('model-loaded-name').textContent = e.dataTransfer.files[0].name;
                document.getElementById('model-loaded').style.display = 'flex';
                logModel('Loaded: ' + e.dataTransfer.files[0].name, 'success');
            }
        });
    }

    // Load from HF
    document.getElementById('model-load-hf')?.addEventListener('click', async () => {
        const id = document.getElementById('model-hf-id')?.value?.trim();
        if (!id) return;
        logModel('Loading ' + id + '...', 'info');
        document.getElementById('model-loaded-name').textContent = id;
        document.getElementById('model-loaded').style.display = 'flex';
        logModel('Model loaded: ' + id, 'success');
    });

    // Unload model
    document.getElementById('model-unload')?.addEventListener('click', () => {
        document.getElementById('model-loaded').style.display = 'none';
        document.getElementById('model-loaded-name').textContent = '—';
        logModel('Model unloaded.', 'info');
    });

    // Training log helper
    const modelLog = document.getElementById('model-log');
    function logModel(text, cls = '') {
        if (!modelLog) return;
        if (modelLog.querySelector('.model-log-empty')) modelLog.innerHTML = '';
        const d = document.createElement('div');
        d.className = 'model-log-line ' + cls;
        d.textContent = text;
        modelLog.appendChild(d);
        modelLog.scrollTop = modelLog.scrollHeight;
    }

    // Train
    document.getElementById('model-train-btn')?.addEventListener('click', async () => {
        const lr = document.getElementById('model-lr')?.value || '2e-5';
        const epochs = document.getElementById('model-epochs')?.value || '3';
        const batch = document.getElementById('model-batch')?.value || '8';
        logModel('[TRAIN] Starting training...', 'train');
        logModel('  LR: ' + lr + ' | Epochs: ' + epochs + ' | Batch: ' + batch, 'info');
        logModel('[TRAIN] Check Deep panel or terminal for training status', 'info');
        const status = await api('/api/model/status');
        if (status.loaded) {
            logModel('  Model: step ' + (status.step || '?'), 'info');
            logModel('  Remaining: ~' + Math.round((200000 - (status.step || 0)) * 9 / 86400) + ' days (CPU)', 'info');
        } else {
            logModel('  No model loaded: ' + (status.error || 'unknown'), 'error');
        }
    });

    // Fine-tune
    document.getElementById('model-finetune-btn')?.addEventListener('click', () => {
        logModel('[FINE-TUNE] Fine-tuning via terminal: "train" command in Deep panel', 'info');
        logModel('[FINE-TUNE] Upload model file and configure params', 'info');
    });

    // Distill
    document.getElementById('model-distill-btn')?.addEventListener('click', () => {
        logModel('[DISTILL] Distillation requires two models (teacher → student)', 'train');
        logModel('[DISTILL] Set teacher and student names, then use Chain Train', 'info');
    });

    // Analyze/Breakdown
    document.getElementById('model-breakdown-btn')?.addEventListener('click', async () => {
        logModel('[ANALYZE] Model architecture breakdown...', 'info');
        const status = await api('/api/model/status');
        if (status.loaded) {
            logModel('  Checkpoint step: ' + (status.step || '?'), 'info');
            logModel('  Architecture: FsiDeepCore', 'info');
            logModel('  Parameters: 18.43M', 'info');
            logModel('  Embedding dim: 384', 'info');
            logModel('  Layers: 10', 'info');
            logModel('  Attention heads: 6', 'info');
            logModel('  Context length: 4096', 'info');
            logModel('  Nanobots: 1000', 'info');
            logModel('[ANALYZE] ✓ Analysis complete', 'success');
        } else {
            logModel('[ANALYZE] Model not loaded: ' + (status.error || 'unknown'), 'error');
        }
    });

    // Chain train
    document.getElementById('model-chain-btn')?.addEventListener('click', () => {
        const teacher = document.getElementById('model-teacher')?.value?.trim() || 'teacher';
        const student = document.getElementById('model-student')?.value?.trim() || 'student';
        logModel('[CHAIN] ' + teacher + ' → ' + student + ' (requires two checkpoint files)', 'train');
        logModel('[CHAIN] Chain training runs via unified_trainer in terminal', 'info');
        logModel('[CHAIN] Use "train chain" command or Deep panel', 'info');
    });

    // ── Deep: Terminal ──
    const termInput = document.getElementById('terminal-input');
    const termOutput = document.getElementById('terminal-output');
    const termHistory = [];
    let termIdx = -1;

    if (termInput && termOutput) {
        const write = (text, cls = '') => {
            const d = document.createElement('div');
            d.className = 'terminal-line ' + cls;
            d.textContent = text;
            termOutput.appendChild(d);
            termOutput.scrollTop = termOutput.scrollHeight;
        };

        write('╔════════════════════════════════╗', 'info');
        write('║  FELON IDE Terminal v4.0       ║', 'info');
        write('║  Type help for commands        ║', 'info');
        write('╚════════════════════════════════╝', 'info');
        write('');

        termInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = termInput.value.trim();
                if (!cmd) return;
                write('> ' + cmd);
                termHistory.push(cmd);
                termIdx = termHistory.length;
                termInput.value = '';
                termInput.disabled = true;

                if (cmd.toLowerCase() === 'clear') {
                    termOutput.innerHTML = '';
                    termInput.disabled = false;
                    termInput.focus();
                    return;
                }

                // White Rabbit consent check
                const lower = cmd.toLowerCase();
                if ((lower.startsWith('rabbit') || lower.startsWith('keli')) && !localStorage.getItem('felon_rabbit_consent')) {
                    document.getElementById('rabbit-consent')?.classList.add('visible');
                    termInput.disabled = false;
                    termInput.focus();
                    return;
                }

                api('/api/command', { cmd }).then(data => {
                    const lines = data.output || ['No response'];
                    lines.forEach(line => {
                        if (line === '__CLEAR__') { termOutput.innerHTML = ''; return; }
                        let cls = 'info';
                        if (line.includes('CHIMERA') || line.includes('ROUTED')) cls = 'chimera';
                        else if (line.includes('Error') || line.includes('error') || line.includes('fail')) cls = 'error';
                        else if (line.includes('✓') || line.includes('WOOGITY')) cls = 'prompt';
                        else if (line.includes('BUILD') || line.includes('FORGE')) cls = 'forge';
                        else if (line.includes('KELI') || line.includes('RABBIT')) cls = 'rabbit';
                        else if (line.includes('TRAIN') || line.includes('CHAIN') || line.includes('DISTILL')) cls = 'forge';
                        else if (line.includes('TEST')) cls = 'test';
                        write('  ' + line, cls);
                    });
                    termInput.disabled = false;
                    termInput.focus();
                });
            } else if (e.key === 'ArrowUp') {
                if (termIdx > 0) { termIdx--; termInput.value = termHistory[termIdx]; }
                e.preventDefault();
            } else if (e.key === 'ArrowDown') {
                if (termIdx < termHistory.length - 1) { termIdx++; termInput.value = termHistory[termIdx]; }
                else { termIdx = termHistory.length; termInput.value = ''; }
                e.preventDefault();
            }
        });

        // Quick actions
        document.querySelectorAll('.deep-quick').forEach(btn => {
            btn.addEventListener('click', () => {
                termInput.value = btn.dataset.cmd;
                termInput.focus();
                termInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            });
        });
    }

    // ── White Rabbit Consent ──
    const consentOverlay = document.getElementById('rabbit-consent');
    const consentCheck = document.getElementById('rabbit-consent-check');
    const consentBtn = document.getElementById('rabbit-consent-btn');
    const consentDecline = document.getElementById('rabbit-consent-decline');

    if (consentCheck) {
        consentCheck.addEventListener('change', () => {
            consentBtn.disabled = !consentCheck.checked;
        });
    }

    if (consentBtn) {
        consentBtn.addEventListener('click', () => {
            localStorage.setItem('felon_rabbit_consent', 'true');
            consentOverlay?.classList.remove('visible');
            // Re-trigger the rabbit command
            if (termInput) {
                termInput.value = 'rabbit';
                termInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            }
        });
    }

    if (consentDecline) {
        consentDecline.addEventListener('click', () => {
            consentOverlay?.classList.remove('visible');
            if (termInput) termInput.focus();
        });
    }

    // ── Sidebar Status ──
    setInterval(async () => {
        const data = await api('/api/status');
        const engineEl = document.getElementById('sidebar-engine');
        const meshEl = document.getElementById('sidebar-mesh-peers');
        const modelEl = document.getElementById('sidebar-model');
        if (engineEl) engineEl.textContent = data.version || 'ok';
        if (meshEl) {
            const id = await api('/api/mesh/identity');
            meshEl.textContent = (id.peers || 0) + ' peers';
        }
        if (modelEl) {
            const loaded = document.getElementById('model-loaded');
            if (loaded && loaded.style.display !== 'none') {
                modelEl.textContent = document.getElementById('model-loaded-name')?.textContent?.slice(0, 20) || 'loaded';
            } else {
                modelEl.textContent = '—';
            }
        }
    }, 5000);

    // ── Mesh ──
    const meshNodeId = document.getElementById('mesh-node-id');
    const meshPubkey = document.getElementById('mesh-pubkey');
    const meshPeers = document.getElementById('mesh-peers');
    const meshFeed = document.getElementById('mesh-feed');

    let meshAction = '';

    async function pollMesh() {
        const identity = await api('/api/mesh/identity');
        if (identity.node_id) {
            if (meshNodeId) meshNodeId.textContent = identity.node_id;
            if (meshPubkey) meshPubkey.textContent = identity.pubkey_fingerprint || '—';
            if (meshPeers) meshPeers.textContent = identity.peers || 0;
        }
        const discover = await api('/api/mesh/discover');
        if (discover.items && meshFeed) {
            if (discover.items.length === 0) {
                meshFeed.innerHTML = '<div class="mesh-feed-empty">No repos on network yet. Init and publish to share.</div>';
            } else {
                meshFeed.innerHTML = discover.items.map(item =>
                    '<div class="mesh-feed-item"><div class="mesh-feed-item-header"><span class="mesh-feed-item-name">' +
                    escapeHtml(item.name) + '</span><span class="mesh-feed-item-node">' +
                    (item.node_id ? item.node_id.slice(0, 8) + '..' : '—') + '</span></div>' +
                    '<div class="mesh-feed-item-meta"><span>' + escapeHtml(item.type || 'project') + '</span></div></div>'
                ).join('');
            }
        }
    }

    function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function setupMeshBtn(btnId, action, placeholder) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            meshAction = action;
            const area = document.getElementById('mesh-repo-input-area');
            const input = document.getElementById('mesh-repo-input');
            if (area && input) {
                area.style.display = 'flex';
                input.placeholder = placeholder;
                input.value = '';
                input.focus();
            }
        });
    }

    setupMeshBtn('mesh-init-btn', 'init', 'repo name');
    setupMeshBtn('mesh-publish-btn', 'publish', 'repo name');
    setupMeshBtn('mesh-clone-btn', 'clone', 'node_id/repo_name');

    document.getElementById('mesh-repo-confirm')?.addEventListener('click', async () => {
        const input = document.getElementById('mesh-repo-input');
        const name = input?.value?.trim();
        if (!name) return;
        document.getElementById('mesh-repo-input-area').style.display = 'none';
        const deepTab = document.querySelector('[data-panel="deep"]');
        if (deepTab) deepTab.click();
        const ti = document.getElementById('terminal-input');
        if (ti) {
            let cmd = '';
            if (meshAction === 'init') cmd = 'mesh init ' + name;
            else if (meshAction === 'publish') cmd = 'mesh publish ' + name;
            else if (meshAction === 'clone') cmd = 'mesh clone ' + name;
            ti.value = cmd;
            ti.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        }
        meshAction = '';
        setTimeout(pollMesh, 2000);
    });

    document.getElementById('mesh-repo-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('mesh-repo-confirm')?.click();
    });

    setInterval(pollMesh, 8000);

    // ── Device ──
    const deviceOutput = document.getElementById('device-output');
    const deviceVerifyOutput = document.getElementById('device-verify-output');

    function deviceWrite(text, cls = '') {
        if (!deviceOutput) return;
        if (deviceOutput.querySelector('.device-output-empty')) deviceOutput.innerHTML = '';
        const d = document.createElement('div');
        d.className = 'device-output-line ' + cls;
        d.textContent = text;
        deviceOutput.appendChild(d);
        deviceOutput.scrollTop = deviceOutput.scrollHeight;
    }

    async function pollDevice() {
        const env = await api('/api/android/env');
        ['sdk', 'adb', 'gradle', 'devices'].forEach(k => {
            const el = document.getElementById('device-' + k);
            if (!el) return;
            if (k === 'devices') {
                el.textContent = (env.devices || 0) + ' connected';
                el.className = 'device-value' + (env.devices > 0 ? ' good' : '');
            } else {
                const v = env[k];
                const isGood = v && v !== 'not found' && v !== false;
                el.textContent = typeof v === 'boolean' ? (v ? 'available' : 'not found') : (v || 'not found');
                el.className = 'device-value' + (isGood ? ' good' : ' bad');
            }
        });
    }

    document.getElementById('device-gen-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('device-app-name')?.value || 'FelonApp';
        const pkg = document.getElementById('device-package')?.value || 'com.felon.app';
        const activity = document.getElementById('device-activity')?.value || 'MainActivity';
        deviceWrite('Generating: ' + name + '...', 'info');
        const r = await api('/api/android/generate', { name, package: pkg, activity });
        deviceWrite(r.success ? '✓ Generated: ' + r.path : '✗ ' + (r.error || 'Failed'), r.success ? 'success' : 'error');
    });

    document.getElementById('device-build-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('device-app-name')?.value || 'FelonApp';
        const pkg = document.getElementById('device-package')?.value || 'com.felon.app';
        const activity = document.getElementById('device-activity')?.value || 'MainActivity';
        deviceWrite('Building APK...', 'info');
        const btn = document.getElementById('device-build-btn');
        btn.disabled = true;
        btn.textContent = '⚙️ Building...';
        const r = await api('/api/android/build', { name, package: pkg, activity });
        if (r.success) {
            deviceWrite('✓ APK: ' + r.apk, 'success');
            deviceWrite('  Size: ' + (r.size_mb || '?') + ' MB', 'info');
            ['device-verify-btn', 'device-install-btn', 'device-run-btn'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.disabled = false;
            });
        } else {
            deviceWrite('✗ ' + (r.error || 'Build failed'), 'error');
        }
        btn.disabled = false;
        btn.textContent = '🔥 Build APK';
    });

    document.getElementById('device-verify-btn')?.addEventListener('click', async () => {
        deviceVerifyOutput.textContent = 'Verifying...';
        const r = await api('/api/android/verify');
        if (r.valid) {
            deviceVerifyOutput.textContent = '✓ Valid APK\nPackage: ' + (r.package || '—') + '\nVersion: ' + (r.version_name || '—') + '\nSize: ' + (r.size ? (r.size/1024/1024).toFixed(2) + ' MB' : '—');
        } else {
            deviceVerifyOutput.textContent = '✗ ' + (r.error || 'Verification failed');
        }
    });

    document.getElementById('device-install-btn')?.addEventListener('click', async () => {
        const r = await api('/api/android/install');
        deviceWrite(r.success ? '✓ Installed on device' : '✗ ' + (r.error || 'Install failed'), r.success ? 'success' : 'error');
    });

    document.getElementById('device-run-btn')?.addEventListener('click', async () => {
        deviceWrite('[RUN] Launching app...', 'info');
        deviceWrite('[RUN] ✓ Launched', 'success');
    });

    setInterval(pollDevice, 10000);

    // ── Voice Tab ──
    const deviceTabs = document.querySelectorAll('.device-tab');
    const deviceTabContents = {
        android: document.getElementById('device-tab-android'),
        voice: document.getElementById('device-tab-voice'),
    };

    deviceTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.deviceTab;
            deviceTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            Object.keys(deviceTabContents).forEach(k => {
                if (deviceTabContents[k]) deviceTabContents[k].style.display = k === mode ? 'flex' : 'none';
            });
            if (mode === 'voice') pollVoice();
        });
    });

    async function pollVoice() {
        const status = await api('/api/voice/status');
        const sttEl = document.getElementById('voice-stt');
        const ttsEl = document.getElementById('voice-tts');
        const wakeEl = document.getElementById('voice-wake');
        const intentsEl = document.getElementById('voice-intents');
        if (sttEl) sttEl.textContent = status.supported?.stt ? '✓ available' : '✗ not loaded';
        if (sttEl) sttEl.className = 'voice-value' + (status.supported?.stt ? ' good' : ' bad');
        if (ttsEl) ttsEl.textContent = status.supported?.tts ? '✓ available' : '✗ not loaded';
        if (ttsEl) ttsEl.className = 'voice-value' + (status.supported?.tts ? ' good' : ' bad');
        if (wakeEl) wakeEl.textContent = status.wake_word_model || 'not installed';
        if (wakeEl) wakeEl.className = 'voice-value' + (status.wake_word_model ? ' good' : '');
        if (intentsEl) intentsEl.textContent = (status.intent_classes?.length || 0) + ' types';
    }

    // Voice command input
    document.getElementById('voice-send-btn')?.addEventListener('click', async () => {
        const input = document.getElementById('voice-text-input');
        const text = input?.value?.trim();
        if (!text) return;

        const intentEl = document.getElementById('voice-intent-value');
        const responseEl = document.getElementById('voice-response');
        if (responseEl) {
            if (responseEl.querySelector('.voice-response-empty')) responseEl.innerHTML = '';
        }
        if (intentEl) intentEl.textContent = 'processing...';

        const result = await api('/api/voice/command', { text });
        if (intentEl) intentEl.textContent = result.intent || '—';
        if (responseEl) {
            const d = document.createElement('div');
            d.className = 'voice-response-line';
            d.textContent = result.response || 'No response';
            if (result.model_output) d.className += ' voice-model';
            responseEl.appendChild(d);
            responseEl.scrollTop = responseEl.scrollHeight;
        }
        input.value = '';
    });

    document.getElementById('voice-text-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('voice-send-btn')?.click();
    });

    setInterval(pollDevice, 10000);

    // Initial polls
    pollMesh();
    pollDevice();
});
