/**
 * Ohm's Law Circuit Simulator
 * Interactive virtual electronics laboratory
 * ES6 classes ? physics, rendering, UI separated
 */

/* ============================================================
   CONFIG ? Application constants and thresholds
   ============================================================ */
const Config = {
  VOLTAGE_MIN: 0,
  VOLTAGE_MAX: 1000,
  VOLTAGE_DEFAULT: 12,
  RESISTANCE_MIN: 0,
  RESISTANCE_MAX: 1000,
  RESISTANCE_DEFAULT: 100,
  BULB_RESISTANCE: 24,
  HIGH_VOLTAGE_THRESHOLD: 20,
  HIGH_CURRENT_THRESHOLD: 5,
  MAX_ELECTRONS: 30,
  ELECTRON_BASE_SPEED: 0.002,
  MAX_BRIGHTNESS_CURRENT: 1,
  GRAPH_MAX_POINTS: 300,
  GRAPH_UPDATE_INTERVAL: 50,
  NEEDLE_MAX_ANGLE: 75
};

/** @returns {'bn'|'en'} Active UI language */
function getLang() {
  return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'bn';
}

/* ============================================================
   KATEX HELPERS — formula rendering
   ============================================================ */

/**
 * Render a single LaTeX expression into an element (replaces its content).
 * Falls back to the raw string if KaTeX is not loaded.
 * @param {HTMLElement} el
 * @param {string} latex - LaTeX string (no outer delimiters)
 * @param {boolean} [display=true] - display (block) or inline mode
 */
function renderKatex(el, latex, display = true) {
  if (window.katex) {
    try {
      el.innerHTML = katex.renderToString(latex, { displayMode: display, throwOnError: false });
    } catch (e) {
      el.textContent = latex;
    }
  } else {
    el.textContent = latex;
  }
}

/**
 * Set HTML content that may contain \(...\) or \[...\] KaTeX delimiters,
 * then run auto-render on the element so the math gets typeset.
 * @param {HTMLElement} el
 * @param {string} html - HTML string with optional KaTeX delimiters
 */
function setHtmlWithKatex(el, html) {
  el.innerHTML = html;
  if (window.renderMathInElement) {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true  },
        { left: '\\[', right: '\\]', display: true  },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }
}

/* ============================================================
   PHYSICS ENGINE — Ohm's Law calculations
   ============================================================ */
class PhysicsEngine {
  /**
   * Calculate circuit values using Ohm's Law
   * @param {number} voltage - Source voltage in volts
   * @param {number} resistance - Total resistance in ohms
   * @param {boolean} switchClosed - Whether circuit is closed
   * @returns {Object} Calculated physics values
   */
  static calculate(voltage, resistance, switchClosed) {
    const isShortCircuit = resistance <= 0;
    const totalResistance = isShortCircuit
      ? Config.BULB_RESISTANCE
      : resistance + Config.BULB_RESISTANCE;

    let current = 0;
    let power = 0;
    let voltageDrop = 0;

    if (switchClosed && voltage > 0) {
      current = voltage / totalResistance;
      power = voltage * current;
      voltageDrop = isShortCircuit ? 0 : current * resistance;
    }

    if (!switchClosed) {
      current = 0;
      power = 0;
      voltageDrop = 0;
    }

    const calculatedBrightness = switchClosed
      ? Math.min(100, (current / Config.MAX_BRIGHTNESS_CURRENT) * 100)
      : 0;
    const brightness = calculatedBrightness > 0 ? Math.max(1, calculatedBrightness) : 0;

    const electronSpeed = switchClosed && current > 0
      ? Math.min(3, current / 2)
      : 0;

    return {
      voltage,
      resistance,
      current,
      power,
      voltageDrop,
      brightness,
      electronSpeed,
      isShortCircuit,
      switchClosed
    };
  }

  /**
   * Check safety conditions and return warning messages
   * @param {Object} state - Physics state object
   * @returns {string[]} Array of warning messages
   */
  static getSafetyWarnings(state) {
    const warnings = [];
    const lang = getLang();

    if (state.isShortCircuit && state.switchClosed) {
      warnings.push({
        type: 'short',
        message: lang === 'bn'
          ? '\u26A0 \u09B6\u09B0\u09CD\u099F \u09B8\u09BE\u09B0\u09CD\u0995\u09BF\u099F \u2014 \u09B0\u09CB\u09A7 0 \u03A9 \u09B9\u09A4\u09C7 \u09AA\u09BE\u09B0\u09C7 \u09A8\u09BE!'
          : '\u26A0 Short Circuit \u2014 Resistance cannot be 0 \u03A9!'
      });
    }
    if (state.current > Config.HIGH_CURRENT_THRESHOLD && state.switchClosed) {
      warnings.push({
        type: 'current',
        message: lang === 'bn'
          ? '\u26A0 \u0989\u099A\u09CD\u099A \u09AC\u09BF\u09A6\u09CD\u09AF\u09C1\u09CE \u2014 5 A \u09A8\u09BF\u09B0\u09BE\u09AA\u09A6 \u09B8\u09C0\u09AE\u09BE \u0985\u09A4\u09BF\u0995\u09CD\u09B0\u09AE!'
          : '\u26A0 High Current \u2014 Exceeds safe limit of 5 A!'
      });
    }
    if (state.voltage > Config.HIGH_VOLTAGE_THRESHOLD) {
      warnings.push({
        type: 'voltage',
        message: lang === 'bn'
          ? '\u26A0 \u0989\u099A\u09CD\u099A \u09AD\u09CB\u09B2\u09CD\u099F\u09C7\u099C \u2014 20 V \u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE \u09B8\u09C0\u09AE\u09BE \u0985\u09A4\u09BF\u0995\u09CD\u09B0\u09AE!'
          : '\u26A0 High Voltage \u2014 Exceeds 20 V safety threshold!'
      });
    }
    return warnings;
  }
}

/* ============================================================
   CIRCUIT STATE ? Mutable application state
   ============================================================ */
class CircuitState {
  /**
   * Initialize circuit state with defaults
   */
  constructor() {
    this.voltage = Config.VOLTAGE_DEFAULT;
    this.resistance = Config.RESISTANCE_DEFAULT;
    this.switchClosed = true;
    this.paused = false;
    this.time = 0;
    this.physics = PhysicsEngine.calculate(
      this.voltage,
      this.resistance,
      this.switchClosed
    );
  }

  /**
   * Recalculate physics from current state
   */
  updatePhysics() {
    this.physics = PhysicsEngine.calculate(
      this.voltage,
      this.resistance,
      this.switchClosed
    );
  }

  /**
   * Toggle switch open/closed
   * @returns {boolean} New switch state
   */
  toggleSwitch() {
    this.switchClosed = !this.switchClosed;
    this.updatePhysics();
    return this.switchClosed;
  }

  /**
   * Reset to default values
   */
  reset() {
    this.voltage = Config.VOLTAGE_DEFAULT;
    this.resistance = Config.RESISTANCE_DEFAULT;
    this.switchClosed = true;
    this.updatePhysics();
  }

  /**
   * Randomize voltage and resistance
   */
  randomize() {
    this.voltage = Math.round((Math.random() * Config.VOLTAGE_MAX) * 10) / 10;
    this.resistance = Math.floor(Math.random() * (Config.RESISTANCE_MAX - Config.RESISTANCE_MIN)) + Config.RESISTANCE_MIN;
    this.updatePhysics();
  }

}

/* ============================================================
   URL STATE MANAGER — reflect state in shareable query params
   ============================================================ */
class URLStateManager {
  /**
   * Read supported query params from the current URL
   * @returns {Object} Partial state overrides (only keys present in the URL)
   */
  static readParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};

    if (params.has('v')) {
      const v = parseFloat(params.get('v'));
      if (!Number.isNaN(v)) result.voltage = v;
    }
    if (params.has('r')) {
      const r = parseInt(params.get('r'), 10);
      if (!Number.isNaN(r)) result.resistance = r;
    }
    if (params.has('sw')) {
      result.switchClosed = params.get('sw') === '1';
    }
    if (params.get('lang') === 'bn' || params.get('lang') === 'en') {
      result.lang = params.get('lang');
    }
    if (params.get('theme') === 'light' || params.get('theme') === 'dark') {
      result.theme = params.get('theme');
    }

    return result;
  }

  /**
   * Write current state into the URL without adding a history entry
   * @param {CircuitState} state
   * @param {'bn'|'en'} lang
   * @param {'light'|'dark'} theme
   */
  static update(state, lang, theme) {
    const params = new URLSearchParams();
    params.set('v', state.voltage.toFixed(1));
    params.set('r', String(state.resistance));
    params.set('sw', state.switchClosed ? '1' : '0');
    params.set('lang', lang);
    params.set('theme', theme);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }
}

/* ============================================================
   AUDIO MANAGER ? Switch toggle sound via Web Audio API
   ============================================================ */
class AudioManager {
  /**
   * Initialize Web Audio context (lazy)
   */
  constructor() {
    this.context = null;
  }

  /**
   * Ensure audio context is created (requires user interaction)
   */
  init() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  /**
   * Play click sound when switch toggles
   * @param {boolean} closing - True if switch is closing
   */
  playSwitchClick(closing) {
    this.init();
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(closing ? 800 : 400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(closing ? 1200 : 200, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }
}

/* ============================================================
   ELECTRON ANIMATOR ? Animated electrons along wire path
   ============================================================ */
class ElectronAnimator {
  /**
   * @param {SVGElement} container - SVG group for electrons
   * @param {CircuitState} state - Shared circuit state
   */
  constructor(container, state) {
    this.container = container;
    this.state = state;
    this.electrons = [];
    this.pathSegments = this.buildPathSegments();
    this.totalLength = this.pathSegments.reduce((sum, s) => sum + s.length, 0);
    this.createElectrons();
  }

  /**
   * Define clockwise path segments matching circuit wires
   * @returns {Array} Segment definitions with start, end, length
   */
  buildPathSegments() {
    const segments = [
      { x1: 155, y1: 130, x2: 210, y2: 130 },
      { x1: 290, y1: 130, x2: 330, y2: 130 },
      { x1: 410, y1: 130, x2: 470, y2: 130 },
      { x1: 550, y1: 130, x2: 620, y2: 130 },
      { x1: 700, y1: 130, x2: 700, y2: 390 },
      { x1: 700, y1: 390, x2: 100, y2: 390 },
      { x1: 100, y1: 390, x2: 100, y2: 270 },
      { x1: 100, y1: 170, x2: 100, y2: 130 },
      { x1: 100, y1: 130, x2: 155, y2: 130 }
    ];

    return segments.map(seg => ({
      ...seg,
      length: Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1)
    }));
  }

  /**
   * Create electron SVG circle elements
   */
  createElectrons() {
    this.container.innerHTML = '';
    this.electrons = [];

    for (let i = 0; i < Config.MAX_ELECTRONS; i++) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', '4');
      circle.setAttribute('class', 'electron');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      this.container.appendChild(circle);

      this.electrons.push({
        element: circle,
        progress: i / Config.MAX_ELECTRONS
      });
    }
  }

  /**
   * Get x,y position along path at normalized progress [0,1]
   * @param {number} progress
   * @returns {{x: number, y: number}}
   */
  getPositionOnPath(progress) {
    let target = ((progress % 1) + 1) % 1 * this.totalLength;
    let accumulated = 0;

    for (const seg of this.pathSegments) {
      if (accumulated + seg.length >= target) {
        const t = (target - accumulated) / seg.length;
        return {
          x: seg.x1 + (seg.x2 - seg.x1) * t,
          y: seg.y1 + (seg.y2 - seg.y1) * t
        };
      }
      accumulated += seg.length;
    }

    const last = this.pathSegments[this.pathSegments.length - 1];
    return { x: last.x2, y: last.y2 };
  }

  /**
   * Update electron positions each frame
   * @param {number} deltaTime - Frame delta in ms
   */
  update(deltaTime) {
    const speed = this.state.physics.electronSpeed;
    const isActive = speed > 0 && !this.state.paused && this.state.switchClosed;

    this.electrons.forEach(electron => {
      if (isActive) {
        // Real electrons drift opposite to conventional current (− to +),
        // so they travel the path in reverse of the direction arrows.
        electron.progress -= Config.ELECTRON_BASE_SPEED * speed * deltaTime;
        if (electron.progress < 0) electron.progress += 1;
        const pos = this.getPositionOnPath(electron.progress);
        electron.element.setAttribute('cx', pos.x);
        electron.element.setAttribute('cy', pos.y);
        electron.element.style.opacity = '1';
      } else {
        electron.element.style.opacity = '0';
      }
    });
  }
}

/* ============================================================
   SPARK ANIMATOR ? Tiny spark when switch closes
   ============================================================ */
class SparkAnimator {
  /**
   * @param {SVGElement} container - SVG spark group
   */
  constructor(container) {
    this.container = container;
    this.active = false;
    this.sparks = [];
  }

  /**
   * Trigger spark animation at switch contacts
   */
  trigger() {
    this.container.innerHTML = '';
    this.sparks = [];
    this.active = true;

    for (let i = 0; i < 6; i++) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
      const len = 8 + Math.random() * 12;
      line.setAttribute('x1', '270');
      line.setAttribute('y1', '130');
      line.setAttribute('x2', String(270 + Math.cos(angle) * len));
      line.setAttribute('y2', String(130 + Math.sin(angle) * len));
      line.style.opacity = '1';
      this.container.appendChild(line);
      this.sparks.push({ element: line, life: 1 });
    }
  }

  /**
   * Update spark fade-out animation
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!this.active) return;

    let alive = false;
    this.sparks.forEach(spark => {
      spark.life -= deltaTime * 0.004;
      if (spark.life > 0) {
        alive = true;
        spark.element.style.opacity = String(spark.life);
      } else {
        spark.element.style.opacity = '0';
      }
    });

    if (!alive) {
      this.active = false;
      this.container.innerHTML = '';
    }
  }
}

/* ============================================================
   GRAPH MANAGER ? Live canvas graphs
   ============================================================ */
class GraphManager {
  /**
   * @param {Object} canvases - Canvas element references
   * @param {CircuitState} state
   */
  constructor(canvases, state) {
    this.canvases = canvases;
    this.state = state;
    this.data = {
      current: [],
      voltage: [],
      power: []
    };
    this.lastSampleTime = 0;
    this.startTime = performance.now();
  }

  /**
   * Sample data point at interval
   * @param {number} now - Current timestamp
   */
  sample(now) {
    if (now - this.lastSampleTime < Config.GRAPH_UPDATE_INTERVAL) return;
    this.lastSampleTime = now;

    const t = (now - this.startTime) / 1000;
    const p = this.state.physics;

    this.pushData('current', t, p.current);
    this.pushData('voltage', t, p.voltage);
    this.pushData('power', t, p.power);
  }

  /**
   * Add data point with max length limit
   * @param {string} key
   * @param {number} t
   * @param {number} value
   */
  pushData(key, t, value) {
    this.data[key].push({ t, value });
    if (this.data[key].length > Config.GRAPH_MAX_POINTS) {
      this.data[key].shift();
    }
  }

  /**
   * Clear all graph data
   */
  clear() {
    this.data.current = [];
    this.data.voltage = [];
    this.data.power = [];
    this.startTime = performance.now();
    this.lastSampleTime = 0;
  }

  /**
   * Draw all graphs
   */
  draw() {
    // 10MS palette: green=current, red=voltage, amber=power
    this.drawGraph(this.canvases.current, this.data.current, '#1CAB55', 'A');
    this.drawGraph(this.canvases.voltage, this.data.voltage, '#E8001D', 'V');
    this.drawGraph(this.canvases.power, this.data.power, '#EA580C', 'W');
  }

  /**
   * Render a single graph on canvas
   * @param {HTMLCanvasElement} canvas
   * @param {Array} points
   * @param {string} color
   * @param {string} unit
   */
  drawGraph(canvas, points, color, unit) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const padding = { top: 10, right: 10, bottom: 25, left: 45 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? '#0F172A' : '#F9FAFB';
    ctx.fillRect(0, 0, w, h);

    if (points.length < 2) {
      const lang = getLang();
      ctx.fillStyle = isDark ? '#6B7280' : '#9CA3AF';
      ctx.font = lang === 'bn' ? '12px Hind Siliguri, sans-serif' : '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        lang === 'bn' ? '\u09A4\u09A5\u09CD\u09AF \u09B8\u0902\u0997\u09CD\u09B0\u09B9 \u09B9\u099A\u09CD\u099B\u09C7...' : 'Collecting data...',
        w / 2,
        h / 2
      );
      return;
    }

    const tMin = points[0].t;
    const tMax = points[points.length - 1].t;
    const tRange = Math.max(tMax - tMin, 1);

    let vMax = Math.max(...points.map(p => p.value), 0.001);
    vMax *= 1.1;

    ctx.strokeStyle = isDark ? '#334155' : '#E5E7EB';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }

    // Draw filled area under curve
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = padding.left + ((p.t - tMin) / tRange) * plotW;
      const y = padding.top + plotH - (p.value / vMax) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    const lastPt = points[points.length - 1];
    const firstPt = points[0];
    ctx.lineTo(padding.left + ((lastPt.t - tMin) / tRange) * plotW, padding.top + plotH);
    ctx.lineTo(padding.left + ((firstPt.t - tMin) / tRange) * plotW, padding.top + plotH);
    ctx.closePath();
    ctx.fillStyle = color + '18';
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = padding.left + ((p.t - tMin) / tRange) * plotW;
      const y = padding.top + plotH - (p.value / vMax) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = isDark ? '#94A3B8' : '#6B7280';
    ctx.font = '10px Inter, Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(vMax.toFixed(2) + unit, padding.left - 4, padding.top + 4);
    ctx.fillText('0', padding.left - 4, padding.top + plotH);
    ctx.textAlign = 'center';
    const lang = getLang();
    ctx.fillText(lang === 'bn' ? '\u09B8\u09AE\u09AF\u09BC (s)' : 'Time (s)', w / 2, h - 4);
  }
}

/* ============================================================
   CIRCUIT RENDERER ? SVG visual updates
   ============================================================ */
class CircuitRenderer {
  /**
   * @param {CircuitState} state
   */
  constructor(state) {
    this.state = state;
    this.elements = this.cacheElements();
    this.smoothBrightness = 0;
    this.smoothAmmeterAngle = -90;
    this.smoothVoltmeterAngle = -90;
    this.filamentPhase = 0;
  }

  /**
   * Cache DOM/SVG element references
   * @returns {Object}
   */
  cacheElements() {
    return {
      switchArm: document.getElementById('switch-arm'),
      switchStateLabel: document.getElementById('switch-state-label'),
      ammeterNeedle: document.getElementById('ammeter-needle'),
      voltmeterNeedle: document.getElementById('voltmeter-needle'),
      ammeterDigital: document.getElementById('ammeter-digital'),
      voltmeterDigital: document.getElementById('voltmeter-digital'),
      batteryFill: document.getElementById('battery-fill'),
      batteryGlow: document.getElementById('battery-glow'),
      batteryVoltageLabel: document.getElementById('battery-voltage-label'),
      resistorValueLabel: document.getElementById('resistor-value-label'),
      bulbGlow: document.getElementById('bulb-glow'),
      bulbGlass: document.querySelector('.bulb-glass'),
      bulbFilament: document.getElementById('bulb-filament'),
      bulbBrightnessLabel: document.getElementById('bulb-brightness-label'),
      wires: document.querySelectorAll('.wire:not(.wire-volt)'),
      arrows: document.querySelectorAll('.arrow')
    };
  }

  /**
   * Update switch visual state
   */
  renderSwitch() {
    const closed = this.state.switchClosed;
    const lang = getLang();
    this.elements.switchArm.classList.toggle('open', !closed);
    this.elements.switchStateLabel.textContent = closed
      ? (lang === 'bn' ? '\u09AC\u09A8\u09CD\u09A7' : 'CLOSED')
      : (lang === 'bn' ? '\u0996\u09CB\u09B2\u09BE' : 'OPEN');
    this.elements.switchStateLabel.style.fill = closed ? '#1CAB55' : '#E8001D';
  }

  /**
   * Calculate needle rotation angle from value
   * @param {number} value
   * @param {number} max
   * @returns {number} Angle in degrees
   */
  valueToAngle(value, max) {
    const ratio = Math.min(value / max, 1);
    return -90 + ratio * Config.NEEDLE_MAX_ANGLE * 2;
  }

  /**
   * Smoothly interpolate needle angle
   * @param {number} current
   * @param {number} target
   * @param {number} deltaTime
   * @returns {number}
   */
  lerpAngle(current, target, deltaTime) {
    const factor = 1 - Math.pow(0.001, deltaTime / 16.67);
    return current + (target - current) * factor;
  }

  /**
   * Update meter needles and digital displays
   * @param {number} deltaTime
   */
  renderMeters(deltaTime) {
    const p = this.state.physics;
    const maxCurrent = 10;
    const maxVoltage = Config.VOLTAGE_MAX;

    const targetAmmeter = this.valueToAngle(p.current, maxCurrent);
    const targetVoltmeter = this.valueToAngle(p.voltageDrop, maxVoltage);

    this.smoothAmmeterAngle = this.lerpAngle(this.smoothAmmeterAngle, targetAmmeter, deltaTime);
    this.smoothVoltmeterAngle = this.lerpAngle(this.smoothVoltmeterAngle, targetVoltmeter, deltaTime);

    this.elements.ammeterNeedle.setAttribute(
      'transform',
      `rotate(${this.smoothAmmeterAngle}, 370, 130)`
    );
    this.elements.voltmeterNeedle.setAttribute(
      'transform',
      `rotate(${this.smoothVoltmeterAngle}, 510, 230)`
    );

    const currentText = p.current >= 100 ? p.current.toExponential(2) : p.current.toFixed(3);
    this.elements.ammeterDigital.textContent = `${currentText} A`;
    this.elements.voltmeterDigital.textContent = `${p.voltageDrop.toFixed(2)} V`;
  }

  /**
   * Update bulb brightness and filament animation
   * @param {number} deltaTime
   */
  renderBulb(deltaTime) {
    const target = this.state.physics.brightness;

    // Lerp toward target, then snap when close enough to stop endless drift
    const diff = target - this.smoothBrightness;
    if (Math.abs(diff) < 0.05) {
      this.smoothBrightness = target;
    } else {
      this.smoothBrightness += diff * Math.min(1, deltaTime * 0.005);
    }

    const b = this.smoothBrightness / 100;

    // Warm bulb-on amber, interpolated smoothly from the theme's off-gray glass —
    // a steady glow whose color, size, and intensity all scale with brightness.
    const rootStyle = getComputedStyle(document.documentElement);
    const offColor = rootStyle.getPropertyValue('--bulb-off').trim() || '#D1D5DB';
    const onColor = rootStyle.getPropertyValue('--bulb-on').trim() || '#FBBF24';
    const glassColor = this.interpolateColor(offColor, onColor, b);
    const glowRadius = 32 + b * 22;

    // .style.* (not setAttribute) — the CSS classes for these elements declare
    // their own fill/stroke, which as a stylesheet rule always wins over a plain
    // presentation attribute. Only an inline style can actually override it.
    this.elements.bulbGlow.style.fill = onColor;
    this.elements.bulbGlow.setAttribute('opacity', (b * 0.85).toString());
    this.elements.bulbGlow.setAttribute('r', glowRadius.toString());
    this.elements.bulbGlass.style.fill = glassColor;

    if (b > 0.05) {
      const filamentColor = this.interpolateColor('#78716c', onColor, b);
      this.elements.bulbFilament.style.stroke = filamentColor;
      this.elements.bulbFilament.style.strokeWidth = String(2 + b * 2);
      if (b > 0.3) {
        this.elements.bulbFilament.setAttribute('filter', 'url(#glow-yellow)');
      } else {
        this.elements.bulbFilament.removeAttribute('filter');
      }
    } else {
      this.elements.bulbFilament.style.stroke = '#78716c';
      this.elements.bulbFilament.style.strokeWidth = '2';
      this.elements.bulbFilament.removeAttribute('filter');
    }

    // Display stable target percentage ? not the animated lerp value
    this.elements.bulbBrightnessLabel.textContent = `${Math.round(target)}%`;
  }

  /**
   * Interpolate between two hex colors
   * @param {string} c1
   * @param {string} c2
   * @param {number} t
   * @returns {string}
   */
  interpolateColor(c1, c2, t) {
    const parse = hex => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
    const a = parse(c1);
    const b = parse(c2);
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  /**
   * Update battery fill and glow based on voltage
   */
  renderBattery() {
    const v = this.state.voltage;
    const ratio = v / Config.VOLTAGE_MAX;
    const fillHeight = Math.max(4, ratio * 92);
    const fillY = 174 + (92 - fillHeight);

    this.elements.batteryFill.setAttribute('y', String(fillY));
    this.elements.batteryFill.setAttribute('height', String(fillHeight));
    this.elements.batteryFill.setAttribute('opacity', String(0.3 + ratio * 0.5));

    const glowIntensity = ratio * 0.25;
    this.elements.batteryGlow.setAttribute('fill', `rgba(34, 197, 94, ${glowIntensity})`);

    this.elements.batteryVoltageLabel.textContent = `${v.toFixed(1)} V`;
    this.elements.resistorValueLabel.textContent = `${this.state.resistance} \u03A9`;
  }

  /**
   * Update wire glow intensity based on current
   */
  renderWires() {
    const p = this.state.physics;
    const glow = p.switchClosed && p.current > 0
      ? Math.min(1, p.current / 5)
      : 0;

    this.elements.wires.forEach(wire => {
      if (glow > 0.01) {
        wire.setAttribute('stroke', `rgba(0, 191, 255, ${0.4 + glow * 0.6})`);
        wire.setAttribute('filter', 'url(#glow-wire)');
      } else {
        wire.removeAttribute('filter');
        wire.style.stroke = '';
      }
    });

    this.elements.arrows.forEach(arrow => {
      arrow.style.opacity = p.switchClosed && p.current > 0 ? '0.9' : '0.2';
    });
  }

  /**
   * Render all SVG visuals
   * @param {number} deltaTime
   */
  render(deltaTime) {
    this.renderSwitch();
    this.renderMeters(deltaTime);
    this.renderBulb(deltaTime);
    this.renderBattery();
    this.renderWires();
  }
}

/* ============================================================
   UI CONTROLLER ? Dashboard, controls, education text
   ============================================================ */
class UIController {
  /**
   * @param {CircuitState} state
   * @param {Object} callbacks - Event callbacks
   */
  constructor(state, callbacks) {
    this.state = state;
    this.callbacks = callbacks;
    this.elements = this.cacheElements();
    this.bindEvents();
  }

  /**
   * Cache UI element references
   * @returns {Object}
   */
  cacheElements() {
    return {
      voltageSlider: document.getElementById('voltage-slider'),
      resistanceSlider: document.getElementById('resistance-slider'),
      voltageInput: document.getElementById('voltage-input'),
      resistanceInput: document.getElementById('resistance-input'),
      dashVoltage: document.getElementById('dash-voltage'),
      dashCurrent: document.getElementById('dash-current'),
      dashResistance: document.getElementById('dash-resistance'),
      dashPower: document.getElementById('dash-power'),
      dashBrightness: document.getElementById('dash-brightness'),
      dashSwitch: document.getElementById('dash-switch'),
      calcOhm: document.getElementById('calc-ohm'),
      calcCurrent: document.getElementById('calc-current'),
      calcPower: document.getElementById('calc-power'),
      eduVoltage: document.getElementById('edu-voltage'),
      eduCurrent: document.getElementById('edu-current'),
      eduResistance: document.getElementById('edu-resistance'),
      eduPower: document.getElementById('edu-power'),
      eduOhmsLaw: document.getElementById('edu-ohmslaw'),
      eduEmf: document.getElementById('edu-emf'),
      eduResistivity: document.getElementById('edu-resistivity'),
      eduEquivalent: document.getElementById('edu-equivalent'),
      safetyBanner: document.getElementById('safety-banner')
    };
  }

  /**
   * Bind all UI event listeners
   */
  bindEvents() {
    this.elements.voltageSlider.addEventListener('input', () => {
      this.state.voltage = parseFloat(this.elements.voltageSlider.value);
      this.state.updatePhysics();
      this.callbacks.onStateChange();
    });

    this.elements.resistanceSlider.addEventListener('input', () => {
      this.state.resistance = parseInt(this.elements.resistanceSlider.value, 10);
      this.state.updatePhysics();
      this.callbacks.onStateChange();
    });

    this.elements.voltageInput.addEventListener('input', () => {
      const val = parseFloat(this.elements.voltageInput.value);
      if (Number.isNaN(val)) return;
      this.state.voltage = Math.max(Config.VOLTAGE_MIN, Math.min(Config.VOLTAGE_MAX, val));
      this.state.updatePhysics();
      this.callbacks.onStateChange();
    });
    this.elements.voltageInput.addEventListener('change', () => {
      this.syncControls();
    });

    this.elements.resistanceInput.addEventListener('input', () => {
      const val = parseFloat(this.elements.resistanceInput.value);
      if (Number.isNaN(val)) return;
      this.state.resistance = Math.round(Math.max(Config.RESISTANCE_MIN, Math.min(Config.RESISTANCE_MAX, val)));
      this.state.updatePhysics();
      this.callbacks.onStateChange();
    });
    this.elements.resistanceInput.addEventListener('change', () => {
      this.syncControls();
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      this.callbacks.onReset();
    });

    document.getElementById('btn-randomize').addEventListener('click', () => {
      this.callbacks.onRandomize();
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      this.state.paused = true;
      this.callbacks.onStateChange();
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
      this.state.paused = false;
      this.callbacks.onStateChange();
    });

    document.getElementById('switch').addEventListener('click', () => {
      this.callbacks.onSwitchToggle();
    });

    document.getElementById('switch').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.callbacks.onSwitchToggle();
      }
    });
  }

  /**
   * Sync slider values from state
   */
  syncControls() {
    this.elements.voltageSlider.value = this.state.voltage;
    this.elements.resistanceSlider.value = this.state.resistance;

    // Don't clobber the number input while the user is actively typing in it \u2014
    // only re-sync its displayed value when something else changed the state.
    if (document.activeElement !== this.elements.voltageInput) {
      this.elements.voltageInput.value = this.state.voltage.toFixed(1);
    }
    if (document.activeElement !== this.elements.resistanceInput) {
      this.elements.resistanceInput.value = this.state.resistance;
    }
  }

  /**
   * Update dashboard and educational text
   */
  updateDashboard() {
    const p = this.state.physics;
    const lang = getLang();
    const mul = '\u00D7';
    const arr = '\u2192';

    this.elements.dashVoltage.textContent = p.voltage.toFixed(2);
    this.elements.dashCurrent.textContent = p.current >= 100
      ? p.current.toExponential(2)
      : p.current.toFixed(3);
    this.elements.dashResistance.textContent = String(p.resistance);
    this.elements.dashPower.textContent = p.power >= 100
      ? p.power.toExponential(2)
      : p.power.toFixed(2);
    this.elements.dashBrightness.textContent = `${Math.round(p.brightness)}%`;

    const switchEl = this.elements.dashSwitch;
    switchEl.textContent = p.switchClosed
      ? (lang === 'bn' ? '\u09AC\u09A8\u09CD\u09A7' : 'CLOSED')
      : (lang === 'bn' ? '\u0996\u09CB\u09B2\u09BE' : 'OPEN');
    switchEl.className = `dash-value ${p.switchClosed ? 'dash-switch-closed' : 'dash-switch-open'}`;

    if (p.switchClosed && p.resistance > 0) {
      const totalR = p.resistance + Config.BULB_RESISTANCE;
      renderKatex(this.elements.calcOhm,
        `V = I \\times R \\Rightarrow ${p.voltageDrop.toFixed(2)} = ${p.current.toFixed(3)} \\times ${p.resistance}`);
      renderKatex(this.elements.calcCurrent,
        `I = \\dfrac{V}{R} \\Rightarrow ${p.current.toFixed(3)} = \\dfrac{${p.voltage.toFixed(2)}}{${totalR}}`);
      renderKatex(this.elements.calcPower,
        `P = V \\times I \\Rightarrow ${p.power.toFixed(2)} = ${p.voltage.toFixed(2)} \\times ${p.current.toFixed(3)}`);
    } else if (!p.switchClosed) {
      if (lang === 'bn') {
        renderKatex(this.elements.calcOhm,    `V = I \\times R \\Rightarrow \\text{সার্কিট খোলা}\ (I = 0\\text{ A})`);
        renderKatex(this.elements.calcCurrent, `I = \\dfrac{V}{R} \\Rightarrow \\text{সুইচ খোলা}`);
        renderKatex(this.elements.calcPower,   `P = V \\times I \\Rightarrow \\text{শক্তি} = 0\\text{ W}`);
      } else {
        renderKatex(this.elements.calcOhm,    `V = I \\times R \\Rightarrow \\text{Circuit open}\ (I = 0\\text{ A})`);
        renderKatex(this.elements.calcCurrent, `I = \\dfrac{V}{R} \\Rightarrow \\text{Switch is OPEN}`);
        renderKatex(this.elements.calcPower,   `P = V \\times I \\Rightarrow \\text{Power} = 0\\text{ W}`);
      }
    } else if (lang === 'bn') {
      renderKatex(this.elements.calcOhm,    `V = I \\times R \\Rightarrow \\text{শর্ট সার্কিট!}`);
      renderKatex(this.elements.calcCurrent, `I = \\dfrac{V}{R} \\Rightarrow \\text{বিদ্যুৎ অত্যন্ত বেশি}`);
      renderKatex(this.elements.calcPower,   `P = V \\times I \\Rightarrow \\text{শক্তি অত্যন্ত বেশি}`);
    } else {
      renderKatex(this.elements.calcOhm,    `V = I \\times R \\Rightarrow \\text{Short circuit!}`);
      renderKatex(this.elements.calcCurrent, `I = \\dfrac{V}{R} \\Rightarrow \\text{Current extremely high}`);
      renderKatex(this.elements.calcPower,   `P = V \\times I \\Rightarrow \\text{Power extremely high}`);
    }

    this.updateEducationDynamic(p);
    this.updateSafetyBanner(p);
  }

  /**
   * Update educational section with live values (bilingual)
   * @param {Object} p - Physics state
   */
  updateEducationDynamic(p) {
    const currentMa = (p.current * 1000).toFixed(1);
    const ohm = '\\Omega';
    const mul = '\\times';
    const totalR = p.resistance + Config.BULB_RESISTANCE;

    setHtmlWithKatex(this.elements.eduVoltage,
      `<span class="lang-bn">ধরো, তুমি একটি পাইপ দিয়ে পানি পাঠাতে চাও — ঠিক সেভাবেই বর্তনীতে ইলেকট্রনকে এগিয়ে নিতে বৈদ্যুতিক চাপ দরকার। এই চাপকেই বিভব পার্থক্য বা ভোল্টেজ বলে। তোমার সেটিংসে প্রযোজ্য ভোল্টেজ \\(V = ${p.voltage.toFixed(1)}\\text{ V}\\), মানে প্রতিটি কুলম্ব চার্জ \\(${p.voltage.toFixed(1)}\\text{ J}\\) শক্তি পেতে পারে।</span>` +
      `<span class="lang-en">Think of voltage as the electrical pressure that pushes electrons through the circuit. With your settings, the applied voltage is \\(V = ${p.voltage.toFixed(1)}\\text{ V}\\), meaning each coulomb of charge gains \\(${p.voltage.toFixed(1)}\\text{ J}\\) of energy.</span>`);

    setHtmlWithKatex(this.elements.eduCurrent,
      `<span class="lang-bn">কারেন্ট হল সার্কিটে ইলেকট্রনের প্রবাহের হার, যা অ্যাম্পিয়ারে \\(\\text{A}\\) মাপা হয়। তোমার সেটিংসে ${p.switchClosed ? `\\(I = ${p.current.toFixed(3)}\\text{ A}\\) (বা \\(${currentMa}\\text{ mA}\\))` : '\\(I = 0\\text{ A}\\)'} প্রবাহিত হচ্ছে। ${p.switchClosed ? `\\(I = \\frac{V}{R} = \\frac{${p.voltage.toFixed(1)}}{${totalR}} = ${p.current.toFixed(3)}\\text{ A}\\)` : 'সুইচ খোলা থাকায় কোনো প্রবাহ নেই।'}</span>` +
      `<span class="lang-en">Current is the rate of electron flow through the circuit, measured in amperes (\\(\\text{A}\\)). With your settings, ${p.switchClosed ? `\\(I = ${p.current.toFixed(3)}\\text{ A}\\) (or \\(${currentMa}\\text{ mA}\\))` : '\\(I = 0\\text{ A}\\)'} flows clockwise. ${p.switchClosed ? `\\(I = \\frac{V}{R_s} = \\frac{${p.voltage.toFixed(1)}}{${totalR}} = ${p.current.toFixed(3)}\\text{ A}\\)` : ''}</span>`);

    setHtmlWithKatex(this.elements.eduResistance,
      `<span class="lang-bn">রোধ হল পরিবাহীতে বিদ্যুৎ প্রবাহকে বাধা দেয়। তোমার বাহ্যিক রেজিস্টার \\(R_x = ${p.resistance}\\,${ohm}\\), আর সার্কিটের মোট রোধ \\(R_s = ${totalR}\\,${ohm}\\)। একই ভোল্টেজে বেশি রোধ মানে কম কারেন্ট।</span>` +
      `<span class="lang-en">Resistance opposes current flow. Your external resistor is \\(R_x = ${p.resistance}\\,${ohm}\\), and the total circuit resistance is \\(R_s = ${totalR}\\,${ohm}\\). For the same voltage, higher resistance means less current.</span>`);

    setHtmlWithKatex(this.elements.eduPower,
      `<span class="lang-bn">শক্তি হল বৈদ্যুতিক শক্তি রূপান্তরের হার, যা ওয়াট (\\(\\text{W}\\)) এ মাপা হয়। \\(P = V \\times I = ${p.voltage.toFixed(1)} \\times ${p.current.toFixed(3)} = ${p.power.toFixed(2)}\\text{ W}\\)।</span>` +
      `<span class="lang-en">Power is the rate of electrical energy conversion, measured in watts (\\(\\text{W}\\)). \\(P = V \\times I = ${p.voltage.toFixed(1)} \\times ${p.current.toFixed(3)} = ${p.power.toFixed(2)}\\text{ W}\\).</span>`);

    setHtmlWithKatex(this.elements.eduOhmsLaw,
      `<span class="lang-bn">ওমের সূত্র বলে \\(V = I \\times R_s\\)। এখানে \\(V = ${p.voltage.toFixed(1)}\\text{ V}\\), \\(I = ${p.current.toFixed(3)}\\text{ A}\\) এবং মোট \\(R_s = ${totalR}\\,${ohm}\\)।</span>` +
      `<span class="lang-en">Ohm's law states \\(V = I \\times R_s\\). Here \\(V = ${p.voltage.toFixed(1)}\\text{ V}\\), \\(I = ${p.current.toFixed(3)}\\text{ A}\\), and total \\(R_s = ${totalR}\\,${ohm}\\).</span>`);

    setHtmlWithKatex(this.elements.eduEmf,
      `<span class="lang-bn">তড়িৎচালক বল বা EMF হলো ব্যাটারির নিজস্ব বৈদ্যুতিক শক্তি প্রতি কুলম্ব চার্জে, যা চার্জের সম্পূর্ণ সার্কিট ভ্রমণের জন্য সরবরাহ করে।</span>` +
      `<span class="lang-en">EMF is the battery's own electrical energy per unit charge, supplied as charge completes a full circuit.</span>`);

    setHtmlWithKatex(this.elements.eduResistivity,
      `<span class="lang-bn">আপেক্ষিক রোধ হলো উপাদামের নিজস্ব বৈশিষ্ট্য, যা তার দৈর্ঘ্য বা প্রস্থ নয় বরং উপাদামের প্রকৃতির ওপর নির্ভর করে।</span>` +
      `<span class="lang-en">Resistivity is a material property of resistance, depending on the conductor itself rather than its length or cross-section.</span>`);

    setHtmlWithKatex(this.elements.eduEquivalent,
      `<span class="lang-bn">একাধিক রোধ সিরিজ বা প্যারাললে যুক্ত হলে, তাদের একটি তুল্য রোধ দিয়ে প্রতিস্থাপন করলে সার্কিটের মোট আচরণ অপরিবর্তিত থাকে।</span>` +
      `<span class="lang-en">When multiple resistors are in series or parallel, they can be replaced by one equivalent resistor that preserves the circuit's overall behavior.</span>`);
  }


  /**
   * Show or hide safety warning banner
   * @param {Object} p - Physics state
   */
  updateSafetyBanner(p) {
    const warnings = PhysicsEngine.getSafetyWarnings(p);
    const banner = this.elements.safetyBanner;

    if (warnings.length === 0) {
      banner.classList.add('hidden');
      banner.textContent = '';
      return;
    }

    banner.classList.remove('hidden', 'warning-short', 'warning-high-current', 'warning-high-voltage');
    banner.textContent = warnings.map(w => w.message).join('  |  ');

    const types = warnings.map(w => w.type);
    if (types.includes('short')) banner.classList.add('warning-short');
    else if (types.includes('current')) banner.classList.add('warning-high-current');
    else if (types.includes('voltage')) banner.classList.add('warning-high-voltage');
  }

}

/* ============================================================
   LANGUAGE MANAGER ? English / Bangla localization
   ============================================================ */
class LanguageManager {
  /**
   * Initialize language from saved preference or default (Bangla)
   */
  constructor() {
    this.lang = localStorage.getItem('ohm-lang') || 'bn';
    this.apply(this.lang);
  }

  /**
   * Apply language to document and update dynamic chrome
   * @param {'bn'|'en'} lang
   * @returns {'bn'|'en'}
   */
  apply(lang) {
    this.lang = lang === 'en' ? 'en' : 'bn';
    document.documentElement.setAttribute('data-lang', this.lang);
    document.documentElement.setAttribute('lang', this.lang === 'bn' ? 'bn' : 'en');
    localStorage.setItem('ohm-lang', this.lang);
    this.updateDocumentMeta();
    this.updateButtonTitles();
    this.syncLangButtons();
    return this.lang;
  }

  /**
   * Reflect the active language on the header's segmented lang-switch pills
   */
  syncLangButtons() {
    const bnBtn = document.getElementById('btn-lang-bn');
    const enBtn = document.getElementById('btn-lang-en');
    if (bnBtn) bnBtn.classList.toggle('active', this.lang === 'bn');
    if (enBtn) enBtn.classList.toggle('active', this.lang === 'en');
  }

  /**
   * Update page title and meta description for active language
   */
  updateDocumentMeta() {
    const titleBn = document.querySelector('h1 .lang-bn');
    const titleEn = document.querySelector('h1 .lang-en');
    if (this.lang === 'bn' && titleBn) {
      document.title = titleBn.textContent.trim();
    } else if (titleEn) {
      document.title = titleEn.textContent.trim();
    }

    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      const descBn = meta.getAttribute('data-desc-bn');
      const descEn = meta.getAttribute('data-desc-en');
      if (this.lang === 'bn' && descBn) meta.setAttribute('content', descBn);
      else if (descEn) meta.setAttribute('content', descEn);
    }
  }

  /**
   * Update title attributes on buttons that have bilingual data attributes
   */
  updateButtonTitles() {
    const attr = this.lang === 'bn' ? 'data-title-bn' : 'data-title-en';
    document.querySelectorAll(`[${attr}]`).forEach(el => {
      el.setAttribute('title', el.getAttribute(attr));
    });

    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      themeBtn.setAttribute(
        'title',
        this.lang === 'bn' ? '\u09A5\u09BF\u09AE \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8' : 'Toggle theme'
      );
    }

    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) {
      fsBtn.setAttribute('title', this.lang === 'bn' ? '\u09AB\u09C1\u09B2\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09A8' : 'Fullscreen');
    }

    const circuitPanel = document.querySelector('.circuit-panel');
    if (circuitPanel) {
      circuitPanel.setAttribute(
        'aria-label',
        this.lang === 'bn' ? '\u09B8\u09BE\u09B0\u09CD\u0995\u09BF\u099F \u09AC\u09CB\u09B0\u09CD\u09A1' : 'Circuit board'
      );
    }

    const ssBtn = document.getElementById('btn-screenshot');
    if (ssBtn) {
      ssBtn.setAttribute('title', this.lang === 'bn' ? '\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09A8\u09B6\u09AA\u09CD\u099F' : 'Screenshot');
    }

    const switchEl = document.getElementById('switch');
    if (switchEl) {
      switchEl.setAttribute(
        'aria-label',
        this.lang === 'bn' ? '\u09B8\u09BE\u09B0\u09CD\u0995\u09BF\u099F \u09B8\u09C1\u09A7\u09BF\u099A' : 'Circuit switch'
      );
    }
  }
}

/* ============================================================
   THEME MANAGER ? Light/dark mode toggle
   ============================================================ */
class ThemeManager {
  /**
   * Initialize theme from saved preference or default
   */
  constructor() {
    this.theme = localStorage.getItem('ohm-theme') || 'light';
    this.apply(this.theme);
  }

  /**
   * Apply theme to document
   * @param {string} theme - 'light' or 'dark'
   */
  apply(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ohm-theme', theme);
  }

  /**
   * Toggle between light and dark
   * @returns {string} New theme
   */
  toggle() {
    const next = this.theme === 'dark' ? 'light' : 'dark';
    this.apply(next);
    return next;
  }
}

/* ============================================================
   TOOLTIP MANAGER ? Hover tooltips on components
   ============================================================ */
class TooltipManager {
  /**
   * Initialize tooltip hover behavior
   */
  constructor() {
    this.tooltip = document.getElementById('tooltip');
    this.bindEvents();
  }

  /**
   * Bind mouse events to components with data-tooltip
   */
  bindEvents() {
    document.querySelectorAll('[data-tooltip-bn]').forEach(el => {
      el.addEventListener('mouseenter', (e) => this.show(e));
      el.addEventListener('mousemove', (e) => this.move(e));
      el.addEventListener('mouseleave', () => this.hide());
    });
  }

  /**
   * Show tooltip with component description in active language
   * @param {MouseEvent} e
   */
  show(e) {
    const lang = getLang();
    const attr = lang === 'bn' ? 'data-tooltip-bn' : 'data-tooltip-en';
    const text = e.currentTarget.getAttribute(attr);
    if (!text) return;
    this.tooltip.textContent = text;
    this.tooltip.classList.remove('hidden');
    this.move(e);
  }

  /**
   * Position tooltip near cursor
   * @param {MouseEvent} e
   */
  move(e) {
    this.tooltip.style.left = `${e.clientX + 12}px`;
    this.tooltip.style.top = `${e.clientY + 12}px`;
  }

  /**
   * Hide tooltip
   */
  hide() {
    this.tooltip.classList.add('hidden');
  }
}

/* ============================================================
   TUTORIAL STEPS — bilingual guided-walkthrough content
   ============================================================ */
const TUTORIAL_STEPS = [
  {
    target: '.circuit-panel',
    titleBn: 'সিমুলেটরে স্বাগতম!',
    titleEn: 'Welcome to the Simulator!',
    descBn: 'এই ইন্টারেক্টিভ সিমুলেটরে আপনি ওহমের সূত্র সরাসরি প্র্যাকটিক্যালি দেখতে পারবেন। চলুন ধাপে ধাপে দেখি এটি কীভাবে ব্যবহার করবেন।',
    descEn: "This interactive simulator lets you see Ohm's Law in action. Let's walk through how to use it, step by step."
  },
  {
    target: '#battery',
    titleBn: 'ব্যাটারি',
    titleEn: 'Battery',
    descBn: 'এটি সার্কিটের ভোল্টেজ উৎস। ডানপাশের ভোল্টেজ স্লাইডার দিয়ে এর মান পরিবর্তন করা যায়।',
    descEn: "This is the circuit's voltage source. Change its value using the Voltage slider on the right."
  },
  {
    target: '#switch',
    titleBn: 'সুইচ',
    titleEn: 'Switch',
    descBn: 'সার্কিট চালু বা বন্ধ করতে সুইচের ওপর ক্লিক করুন।',
    descEn: 'Click the switch to open or close the circuit.'
  },
  {
    target: '#ammeter',
    titleBn: 'অ্যামিটার',
    titleEn: 'Ammeter',
    descBn: 'সার্কিটে প্রবাহিত তড়িৎ প্রবাহ (কারেন্ট) অ্যাম্পিয়ার এককে পরিমাপ করে।',
    descEn: 'Measures the current flowing through the circuit, in amperes.'
  },
  {
    target: '#resistor',
    titleBn: 'রেজিস্টার',
    titleEn: 'Resistor',
    descBn: 'এটি তড়িৎ প্রবাহে বাধা দেয়। রোধ স্লাইডার দিয়ে এর মান পরিবর্তন করুন।',
    descEn: 'Opposes current flow. Change its value with the Resistance slider.'
  },
  {
    target: '#voltmeter',
    titleBn: 'ভোল্টমিটার',
    titleEn: 'Voltmeter',
    descBn: 'রেজিস্টারের দুই প্রান্তের বিভব পার্থক্য (ভোল্টেজ ড্রপ) পরিমাপ করে।',
    descEn: 'Measures the voltage drop across the resistor.'
  },
  {
    target: '#bulb',
    titleBn: 'বাল্ব',
    titleEn: 'Light Bulb',
    descBn: 'সার্কিটে ব্যয়িত শক্তির (পাওয়ার) ওপর ভিত্তি করে বাল্বের উজ্জ্বলতা পরিবর্তিত হয়।',
    descEn: "The bulb's brightness changes based on the power dissipated in the circuit."
  },
  {
    target: '.control-panel',
    titleBn: 'নিয়ন্ত্রণ প্যানেল',
    titleEn: 'Control Panel',
    descBn: 'স্লাইডার টেনে ভোল্টেজ ও রোধের মান বদলান, অথবা রিসেট/এলোমেলো বাটনে ক্লিক করুন।',
    descEn: 'Drag the sliders to change voltage and resistance, or use the Reset/Randomize buttons.'
  },
  {
    target: '.dashboard',
    titleBn: 'লাইভ ড্যাশবোর্ড',
    titleEn: 'Live Dashboard',
    descBn: 'এখানে সব মান — ভোল্টেজ, কারেন্ট, রোধ, শক্তি — লাইভ দেখা যায়, ওহমের সূত্রের হিসাবসহ।',
    descEn: "See all live values — voltage, current, resistance, power — along with the Ohm's Law calculation."
  },
  {
    target: '.graphs-section',
    titleBn: 'লাইভ গ্রাফ',
    titleEn: 'Live Graphs',
    descBn: 'সময়ের সাথে কারেন্ট, ভোল্টেজ ও শক্তির পরিবর্তন গ্রাফে দেখুন।',
    descEn: 'Watch how current, voltage, and power change over time on these graphs.'
  },
  {
    target: '.header-controls',
    titleBn: 'আরও অপশন',
    titleEn: 'More Options',
    descBn: 'এখান থেকে ভাষা ও থিম পরিবর্তন করুন, স্ক্রিনশট নিন, অথবা সেটিংস এক্সপোর্ট/ইম্পোর্ট করুন। উপভোগ করুন!',
    descEn: 'Switch language, toggle theme, take screenshots, or export/import settings from here. Enjoy exploring!'
  }
];

/* ============================================================
   TUTORIAL MANAGER — spotlight-driven guided walkthrough
   ============================================================ */
class TutorialManager {
  /**
   * @param {Array} steps - Ordered tutorial step definitions
   */
  constructor(steps) {
    this.steps = steps;
    this.index = 0;
    this.elements = {
      overlay: document.getElementById('tutorial-overlay'),
      spotlight: document.getElementById('tutorial-spotlight'),
      box: document.getElementById('tutorial-box'),
      badge: document.getElementById('tutorial-step-badge'),
      title: document.getElementById('tutorial-title'),
      desc: document.getElementById('tutorial-desc'),
      progress: document.getElementById('tutorial-progress'),
      backBtn: document.getElementById('tutorial-back'),
      nextBtn: document.getElementById('tutorial-next'),
      nextBn: document.getElementById('tutorial-next-bn'),
      nextEn: document.getElementById('tutorial-next-en')
    };
    this.reposition = () => { if (this.isActive()) this.positionAt(this.steps[this.index]); };
    this.bindEvents();
  }

  /**
   * Wire up trigger button, nav controls, and dismiss handlers
   */
  bindEvents() {
    document.getElementById('btn-tutorial').addEventListener('click', () => this.start());
    this.elements.nextBtn.addEventListener('click', () => this.next());
    this.elements.backBtn.addEventListener('click', () => this.back());
    document.getElementById('tutorial-skip').addEventListener('click', () => this.end());
    document.getElementById('tutorial-close').addEventListener('click', () => this.end());

    document.addEventListener('keydown', (e) => {
      if (!this.isActive()) return;
      if (e.key === 'Escape') this.end();
      else if (e.key === 'ArrowRight') this.next();
      else if (e.key === 'ArrowLeft') this.back();
    });

    window.addEventListener('resize', this.reposition);
  }

  /**
   * @returns {boolean} Whether the tutorial overlay is currently visible
   */
  isActive() {
    return !this.elements.overlay.classList.contains('hidden');
  }

  /**
   * Begin the tour from the first step
   */
  start() {
    this.index = 0;
    this.elements.overlay.classList.remove('hidden');
    this.renderStep();
  }

  /**
   * Close the tour
   */
  end() {
    this.elements.overlay.classList.add('hidden');
  }

  /**
   * Advance to the next step, or finish on the last one
   */
  next() {
    if (this.index < this.steps.length - 1) {
      this.index++;
      this.renderStep();
    } else {
      this.end();
    }
  }

  /**
   * Return to the previous step
   */
  back() {
    if (this.index > 0) {
      this.index--;
      this.renderStep();
    }
  }

  /**
   * Render text, progress, and spotlight position for the current step
   */
  renderStep() {
    const step = this.steps[this.index];
    const lang = getLang();
    const isLast = this.index === this.steps.length - 1;

    this.elements.badge.textContent = `${this.index + 1}/${this.steps.length}`;
    this.elements.title.textContent = lang === 'bn' ? step.titleBn : step.titleEn;
    this.elements.desc.textContent = lang === 'bn' ? step.descBn : step.descEn;

    this.elements.progress.innerHTML = '';
    this.steps.forEach((_, i) => {
      const dash = document.createElement('span');
      dash.className = 'tutorial-dash' + (i <= this.index ? ' active' : '');
      this.elements.progress.appendChild(dash);
    });

    this.elements.backBtn.style.visibility = this.index === 0 ? 'hidden' : 'visible';
    this.elements.nextBn.textContent = isLast ? 'শেষ করুন' : 'পরবর্তী';
    this.elements.nextEn.textContent = isLast ? 'Finish' : 'Next';

    this.positionAt(step);
  }

  /**
   * Move the spotlight and tooltip box to frame the step's target element
   * @param {Object} step
   */
  positionAt(step) {
    const targetEl = document.querySelector(step.target);
    if (!targetEl) return;

    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const settle = () => {
      const pad = 8;
      const rect = targetEl.getBoundingClientRect();

      this.elements.spotlight.style.top = `${rect.top - pad}px`;
      this.elements.spotlight.style.left = `${rect.left - pad}px`;
      this.elements.spotlight.style.width = `${rect.width + pad * 2}px`;
      this.elements.spotlight.style.height = `${rect.height + pad * 2}px`;

      const boxRect = this.elements.box.getBoundingClientRect();
      let top = rect.bottom + 16;
      let left = rect.left + rect.width / 2 - boxRect.width / 2;

      if (top + boxRect.height > window.innerHeight - 12) {
        top = Math.max(12, rect.top - boxRect.height - 16);
      }
      left = Math.max(12, Math.min(left, window.innerWidth - boxRect.width - 12));

      this.elements.box.style.top = `${top}px`;
      this.elements.box.style.left = `${left}px`;
    };

    settle();
    setTimeout(settle, 320);
  }
}

/* ============================================================
   FEEDBACK MANAGER — Tally form embedded in a popup modal
   ============================================================ */
class FeedbackManager {
  /**
   * @param {string} simulationName - Short identifier passed to Tally as ?simulation_name=
   */
  constructor(simulationName) {
    this.simulationName = simulationName;
    this.overlay = document.getElementById('feedback-overlay');
    this.iframe = document.getElementById('feedback-iframe');
    this.bindEvents();
  }

  /**
   * Wire up the trigger button and dismiss handlers
   */
  bindEvents() {
    document.getElementById('btn-feedback').addEventListener('click', () => this.open());
    document.getElementById('feedback-close').addEventListener('click', () => this.close());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) this.close();
    });
  }

  /**
   * Load the Tally form into the iframe and show the modal
   */
  open() {
    const url = `https://tally.so/r/RG87VJ?simulation_name=${encodeURIComponent(this.simulationName)}`;
    this.iframe.src = url;
    this.overlay.classList.remove('hidden');
  }

  /**
   * Hide the modal and unload the iframe
   */
  close() {
    this.overlay.classList.add('hidden');
    this.iframe.src = '';
  }
}

/* ============================================================
   SIMULATOR APP ? Main application orchestrator
   ============================================================ */
class SimulatorApp {
  /**
   * Initialize all subsystems and start render loop
   */
  constructor() {
    this.state = new CircuitState();
    this.audio = new AudioManager();
    this.theme = new ThemeManager();
    this.lang = new LanguageManager();
    this.applyURLParams();
    this.tooltip = new TooltipManager();
    this.tutorial = new TutorialManager(TUTORIAL_STEPS);
    this.feedback = new FeedbackManager('Ohms_Law_Simulator');

    this.renderer = new CircuitRenderer(this.state);
    this.electrons = new ElectronAnimator(
      document.getElementById('electrons-group'),
      this.state
    );
    this.spark = new SparkAnimator(document.getElementById('spark-group'));
    this.graphs = new GraphManager({
      current: document.getElementById('graph-current'),
      voltage: document.getElementById('graph-voltage'),
      power: document.getElementById('graph-power')
    }, this.state);

    this.ui = new UIController(this.state, {
      onStateChange: () => this.onStateChange(),
      onReset: () => this.reset(),
      onRandomize: () => this.randomize(),
      onSwitchToggle: () => this.toggleSwitch()
    });

    this.lastFrameTime = performance.now();
    this.animationId = null;

    this.bindGlobalEvents();
    this.onStateChange();
    this.startLoop();
  }

  /**
   * Apply state/lang/theme overrides found in the current URL's query params,
   * so a shared link reproduces the exact circuit it was copied from.
   */
  applyURLParams() {
    const overrides = URLStateManager.readParams();

    if (typeof overrides.voltage === 'number') {
      this.state.voltage = Math.max(Config.VOLTAGE_MIN, Math.min(Config.VOLTAGE_MAX, overrides.voltage));
    }
    if (typeof overrides.resistance === 'number') {
      this.state.resistance = Math.max(Config.RESISTANCE_MIN, Math.min(Config.RESISTANCE_MAX, overrides.resistance));
    }
    if (typeof overrides.switchClosed === 'boolean') {
      this.state.switchClosed = overrides.switchClosed;
    }
    if (overrides.lang) {
      this.lang.apply(overrides.lang);
    }
    if (overrides.theme) {
      this.theme.apply(overrides.theme);
    }

    this.state.updatePhysics();
  }

  /**
   * Reflect the current circuit/lang/theme state into the URL query string
   */
  syncURL() {
    URLStateManager.update(this.state, this.lang.lang, this.theme.theme);
  }

  /**
   * Bind header buttons and viewport interactions
   */
  bindGlobalEvents() {
    document.getElementById('btn-theme').addEventListener('click', () => {
      this.theme.toggle();
      this.syncURL();
    });

    document.getElementById('btn-lang-bn').addEventListener('click', () => {
      this.lang.apply('bn');
      this.onStateChange();
      this.graphs.draw();
    });

    document.getElementById('btn-lang-en').addEventListener('click', () => {
      this.lang.apply('en');
      this.onStateChange();
      this.graphs.draw();
    });

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      this.toggleFullscreen();
    });

    document.getElementById('btn-screenshot').addEventListener('click', () => {
      this.takeScreenshot();
    });

    document.getElementById('btn-clear-graphs').addEventListener('click', () => {
      this.graphs.clear();
    });
  }

  /**
   * Handle switch toggle with sound and spark
   */
  toggleSwitch() {
    const wasOpen = !this.state.switchClosed;
    this.state.toggleSwitch();
    this.audio.playSwitchClick(!wasOpen);
    if (this.state.switchClosed) {
      this.spark.trigger();
    }
    this.onStateChange();
  }

  /**
   * Reset circuit to defaults
   */
  reset() {
    this.state.reset();
    this.onStateChange();
  }

  /**
   * Randomize circuit values
   */
  randomize() {
    this.state.randomize();
    this.onStateChange();
  }

  /**
   * Sync UI when state changes
   */
  onStateChange() {
    this.ui.syncControls();
    this.ui.updateDashboard();
    this.renderer.renderSwitch();
    this.syncURL();
  }

  /**
   * Toggle browser fullscreen on app element
   */
  toggleFullscreen() {
    const app = document.getElementById('app');
    if (!document.fullscreenElement) {
      app.requestFullscreen?.() || app.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  /**
   * Capture screenshot of entire app
   */
  takeScreenshot() {
    const svg = document.getElementById('circuit-svg');
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 520;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.fillStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#0F172A' : '#F9FAFB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const link = document.createElement('a');
      link.download = `ohm-circuit-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }

  /**
   * Main animation loop using requestAnimationFrame
   * @param {number} now - Current timestamp
   */
  loop(now) {
    const deltaTime = Math.min(now - this.lastFrameTime, 50);
    this.lastFrameTime = now;

    if (!this.state.paused) {
      this.state.time += deltaTime;
    }

    this.renderer.render(deltaTime);
    this.electrons.update(deltaTime);
    this.spark.update(deltaTime);
    if (!this.state.paused && this.state.switchClosed) {
      this.graphs.sample(now);
    }
    this.graphs.draw();

    this.animationId = requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * Start the animation loop
   */
  startLoop() {
    this.animationId = requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * Stop the animation loop
   */
  stopLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}


/**
 * Scan every .math-block element and render each $$...$$ equation
 * using KaTeX in display mode. This is more reliable than auto-render
 * text-node scanning.
 */
function renderMathBlocks() {
  if (!window.katex) return;
  document.querySelectorAll('.math-block').forEach(function (el) {
    // Split by $$, odd indices are LaTeX, even are plain text/whitespace
    var parts = el.innerHTML.split(/\$\$/);
    var out = '';
    parts.forEach(function (part, i) {
      if (i % 2 === 1) {
        // LaTeX content between $$...$$
        try {
          out += '<div class="katex-line">' +
            katex.renderToString(part.trim(), { displayMode: true, throwOnError: false }) +
            '</div>';
        } catch (e) {
          out += '<div class="katex-line">' + part + '</div>';
        }
      } else {
        // Plain text / whitespace between equations — skip empty
        if (part.trim()) out += part;
      }
    });
    el.innerHTML = out;
  });
}

/* ============================================================
   BOOTSTRAP — Initialize application when DOM is ready
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  new SimulatorApp();

  // Directly render all $$...$$ blocks in NCTB worked examples
  renderMathBlocks();

  // Render any remaining \(...\) inline math (educational section)
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }
});


/**
 * Initialize accessible FAQ accordion behavior
 */

