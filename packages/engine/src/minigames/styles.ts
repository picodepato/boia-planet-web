/** Estilos del anfitrión de minijuegos: se inyectan una vez al montar. */
export const MINIGAME_CSS = `
.mg {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background: var(--mg-night);
  color: #fff;
  font: 500 15px/1.4 var(--font-body, system-ui, -apple-system, 'Segoe UI', sans-serif);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  outline: none;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
.mg-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 4px 8px 4px 14px;
  background: rgba(0, 0, 0, 0.35);
}
.mg-heading { flex: 1; min-width: 0; }
.mg-title { margin: 0; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mg-status { margin: 0; font-size: 13px; opacity: 0.92; font-variant-numeric: tabular-nums; }
.mg-status b { font-weight: 700; }
.mg-nocount { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 6px; background: var(--mg-bad); color: #111; font-size: 11px; font-weight: 700; }
.mg-icon {
  min-width: 48px;
  min-height: 48px;
  border: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  font: 700 17px/1 var(--font-body, system-ui, sans-serif);
  cursor: pointer;
}
.mg-icon:focus-visible, .mg-btn:focus-visible, .mg-action:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.mg-stage { position: relative; flex: 1; min-height: 0; }
.mg-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.mg-feedback {
  position: absolute;
  left: 50%;
  top: 10px;
  transform: translateX(-50%);
  margin: 0;
  padding: 6px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.6);
  font-weight: 700;
  pointer-events: none;
  white-space: nowrap;
}
.mg-feedback:empty { display: none; }
.mg-feedback[data-tone='good'] { border-left: 6px solid var(--mg-good); }
.mg-feedback[data-tone='bad'] { border-left: 6px solid var(--mg-bad); }
.mg-card {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(420px, calc(100% - 24px));
  max-height: calc(100% - 24px);
  overflow: auto;
  box-sizing: border-box;
  padding: 18px 18px 16px;
  border-radius: 16px;
  background: #fffaf0;
  color: #12233f;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  touch-action: auto;
}
.mg-card h3 { margin: 0 0 6px; font-family: var(--font-title, inherit); font-size: 20px; }
.mg-card p { margin: 0 0 8px; }
.mg-card ul { margin: 0 0 10px; padding-left: 20px; }
.mg-card li { margin-bottom: 4px; }
.mg-kicker { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
.mg-small { font-size: 13px; opacity: 0.85; }
.mg-score { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; }
.mg-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.mg-btn {
  flex: 1 1 140px;
  min-height: 48px;
  padding: 0 14px;
  border: 2px solid #12233f;
  border-radius: 12px;
  background: transparent;
  color: #12233f;
  font: 700 16px/1 var(--font-body, system-ui, sans-serif);
  cursor: pointer;
}
.mg-btn.mg-primary { background: var(--mg-accent); border-color: var(--mg-accent); color: var(--mg-on-accent); }
.mg-volume { display: flex; align-items: center; gap: 10px; margin: 6px 0 4px; font-size: 14px; }
.mg-volume input { flex: 1; min-height: 32px; accent-color: var(--mg-accent); }
.mg-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  min-height: 84px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.35);
}
.mg-action {
  width: min(340px, 80%);
  min-height: 64px;
  border: 3px solid rgba(255, 255, 255, 0.85);
  border-radius: 18px;
  background: var(--mg-accent);
  color: var(--mg-on-accent);
  font: 800 22px/1 var(--font-body, system-ui, sans-serif);
  letter-spacing: 0.08em;
  cursor: pointer;
  touch-action: manipulation;
}
.mg-action:disabled { opacity: 0.45; }
.mg-hint { font-size: 12px; opacity: 0.75; }
@media (hover: none) { .mg-hint { display: none; } }
`;
