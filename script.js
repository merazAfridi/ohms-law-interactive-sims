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
  VOLTAGE_MAX: 24,
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
  ZOOM_MIN: 0.5,
  ZOOM_MAX: 2.5,
  ZOOM_STEP: 0.1,
  NEEDLE_MAX_ANGLE: 75,
  SAFE_CURRENT_DISPLAY: 999
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
    const brightness = Math.max(1, calculatedBrightness);

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
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
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

  /**
   * Export state as JSON-serializable object
   * @returns {Object}
   */
  toJSON() {
    return {
      voltage: this.voltage,
      resistance: this.resistance,
      switchClosed: this.switchClosed,
      theme: document.documentElement.getAttribute('data-theme'),
      lang: getLang()
    };
  }

  /**
   * Import state from JSON object
   * @param {Object} data
   */
  fromJSON(data) {
    if (typeof data.voltage === 'number') {
      this.voltage = Math.max(Config.VOLTAGE_MIN, Math.min(Config.VOLTAGE_MAX, data.voltage));
    }
    if (typeof data.resistance === 'number') {
      this.resistance = Math.max(Config.RESISTANCE_MIN, Math.min(Config.RESISTANCE_MAX, data.resistance));
    }
    if (typeof data.switchClosed === 'boolean') {
      this.switchClosed = data.switchClosed;
    }
    this.updatePhysics();
    return { theme: data.theme, lang: data.lang };
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
        electron.progress += Config.ELECTRON_BASE_SPEED * speed * deltaTime;
        if (electron.progress > 1) electron.progress -= 1;
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
      arrows: document.querySelectorAll('.arrow'),
      circuitGroup: document.getElementById('circuit-group')
    };
  }

  /**
   * Apply zoom and pan transform to circuit group
   */
  applyTransform() {
    this.elements.circuitGroup.setAttribute(
      'transform',
      'translate(0, 0) scale(1)'
    );
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
    const glowOpacity = b * 0.7;
    
    const displayVal = Math.round(target);
    let glassColor = '#0C331E';
    if (displayVal >= 81) glassColor = '#14FF6B';
    else if (displayVal >= 61) glassColor = '#169E4A';
    else if (displayVal >= 41) glassColor = '#136B37';
    else if (displayVal >= 21) glassColor = '#114F2A';
    else glassColor = '#0C331E';

    this.elements.bulbGlow.setAttribute('fill', glassColor);
    this.elements.bulbGlow.setAttribute('opacity', glowOpacity.toString());
    this.elements.bulbGlass.setAttribute('fill', glassColor);

    if (b > 0.05) {
      // No random flicker ? use stable filament color based on brightness only
      const filamentColor = this.interpolateColor('#78716c', glassColor, b);
      this.elements.bulbFilament.setAttribute('stroke', filamentColor);
      this.elements.bulbFilament.setAttribute('stroke-width', String(2 + b * 2));
      if (b > 0.3) {
        this.elements.bulbFilament.setAttribute('filter', 'url(#glow-yellow)');
      } else {
        this.elements.bulbFilament.removeAttribute('filter');
      }
    } else {
      this.elements.bulbFilament.setAttribute('stroke', '#78716c');
      this.elements.bulbFilament.setAttribute('stroke-width', '2');
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
    this.applyTransform();
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
      voltageDisplay: document.getElementById('voltage-display'),
      resistanceDisplay: document.getElementById('resistance-display'),
      dashVoltage: document.getElementById('dash-voltage'),
      dashCurrent: document.getElementById('dash-current'),
      dashResistance: document.getElementById('dash-resistance'),
      dashPower: document.getElementById('dash-power'),
      dashBrightness: document.getElementById('dash-brightness'),
      dashElectronSpeed: document.getElementById('dash-electron-speed'),
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
      safetyBanner: document.getElementById('safety-banner'),
      zoomLevel: document.getElementById('zoom-level')
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
    this.elements.voltageDisplay.textContent = `${this.state.voltage.toFixed(1)} V`;
    this.elements.resistanceDisplay.textContent = `${this.state.resistance} \u03A9`;
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
    this.elements.dashElectronSpeed.textContent = `${p.electronSpeed.toFixed(2)}\u00D7`;

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

  /**
   * Update zoom level display
   */
  updateZoomDisplay() {
    this.elements.zoomLevel.textContent = `${Math.round(this.state.zoom * 100)}%`;
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
    return this.lang;
  }

  /**
   * Toggle between Bangla and English
   * @returns {'bn'|'en'}
   */
  toggle() {
    return this.apply(this.lang === 'bn' ? 'en' : 'bn');
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

    const langBtn = document.getElementById('btn-lang');
    if (langBtn) {
      langBtn.setAttribute(
        'title',
        this.lang === 'bn' ? '\u09AD\u09BE\u09B7\u09BE \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u0995\u09B0\u09C1\u09A8' : 'Change language'
      );
      langBtn.setAttribute(
        'aria-label',
        this.lang === 'bn' ? '\u09AD\u09BE\u09B7\u09BE \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u0995\u09B0\u09C1\u09A8' : 'Change language'
      );
    }

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
    this.tooltip = new TooltipManager();

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
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0, panX: 0, panY: 0 };

    this.bindGlobalEvents();
    this.onStateChange();
    this.startLoop();
  }

  /**
   * Bind header buttons and viewport interactions
   */
  bindGlobalEvents() {
    document.getElementById('btn-theme').addEventListener('click', () => {
      this.theme.toggle();
    });

    document.getElementById('btn-lang').addEventListener('click', () => {
      this.lang.toggle();
      this.lang.updateButtonTitles();
      this.onStateChange();
      this.graphs.draw();
    });

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      this.toggleFullscreen();
    });

    document.getElementById('btn-screenshot').addEventListener('click', () => {
      this.takeScreenshot();
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      this.exportSettings();
    });

    document.getElementById('btn-import').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
      this.importSettings(e);
    });

    document.getElementById('btn-clear-graphs').addEventListener('click', () => {
      this.graphs.clear();
    });
  }

  /**
   * Set zoom level within bounds
   * @param {number} zoom
   */
  setZoom(zoom) {
    this.state.zoom = Math.max(Config.ZOOM_MIN, Math.min(Config.ZOOM_MAX, zoom));
    this.ui.updateZoomDisplay();
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
   * Export current settings as JSON file
   */
  exportSettings() {
    const data = this.state.toJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `ohm-circuit-settings-${Date.now()}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }

  /**
   * Import settings from JSON file
   * @param {Event} e - File input change event
   */
  importSettings(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const imported = this.state.fromJSON(data);
        if (imported.theme === 'light' || imported.theme === 'dark') {
          this.theme.apply(imported.theme);
        }
        if (imported.lang === 'bn' || imported.lang === 'en') {
          this.lang.apply(imported.lang);
          this.lang.updateButtonTitles();
        }
        this.onStateChange();
      } catch {
        alert(getLang() === 'bn'
          ? '\u0985\u09AC\u09B2\u09C1\u09AE\u09CD\u09AD \u09AB\u09BE\u09AF\u09BC\u09B2\u0964 \u09B8\u09A0\u09BF\u0995 JSON \u09AB\u09BE\u09AF\u09BC\u09B2 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8\u0964'
          : 'Invalid settings file. Please select a valid JSON export.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
    this.graphs.sample(now);
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

