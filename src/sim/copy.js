/** Labels and slider copy. None of this enters the equations. */

export const CONTROLS = [
  {
    group: "Coupling",
    key: "mu",
    symbol: "μ",
    name: "Relative coupling",
    min: 0,
    max: 1.5,
    step: 0.01,
    digits: 2,
    sentence:
      "How strongly eastern SST pulls on the wind. Raising μ strengthens the Bjerknes feedback and the recharge–discharge together.",
    gloss: (_p, d) => `b = ${d.b.toFixed(2)}`,
  },
  {
    group: "Coupling",
    key: "b0",
    symbol: "b₀",
    name: "Wind–SST coupling scale",
    min: 0.5,
    max: 4,
    step: 0.05,
    digits: 2,
    sentence:
      "How many meters of east–west thermocline tilt one degree would set up at μ = 1. Jin’s high-end value 2.5 is 50 m per °C.",
    gloss: (p) => `${(p.b0 * 20).toFixed(0)} m/°C at μ = 1`,
  },
  {
    group: "Coupling",
    key: "c",
    symbol: "c",
    name: "Eastern SST damping",
    min: 0.2,
    max: 2,
    step: 0.01,
    digits: 2,
    sentence:
      "How fast the eastern Pacific is pulled back toward normal by upwelling and heat loss to the air. Jin’s c = 1 is about two months.",
    gloss: (_p, d) => `${d.sstDampingMonths.toFixed(1)} mo damping`,
  },
  {
    group: "Coupling",
    key: "gamma",
    symbol: "γ",
    name: "Thermocline feedback",
    min: 0,
    max: 1.5,
    step: 0.01,
    digits: 2,
    sentence:
      "How strongly a deep thermocline warms the eastern Pacific. This is the γ h_W term in the temperature equation.",
    gloss: () => "warms the east when h_W > 0",
  },
  {
    group: "Ocean memory",
    key: "r",
    symbol: "r",
    name: "Ocean adjustment",
    min: 0.05,
    max: 1,
    step: 0.01,
    digits: 2,
    sentence:
      "How fast an extra-deep or extra-shallow western thermocline relaxes. Jin’s r = 0.25 is about an eight-month memory.",
    gloss: (_p, d) => `${d.oceanMemoryMonths.toFixed(1)} mo memory`,
  },
  {
    group: "Ocean memory",
    key: "alpha",
    symbol: "α",
    name: "Sverdrup recharge efficiency",
    min: 0,
    max: 0.5,
    step: 0.005,
    digits: 3,
    sentence:
      "How efficiently anomalous winds drain or pile equatorial heat. Jin sets α to about half of r.",
    gloss: (p) => `α / r = ${(p.r ? p.alpha / p.r : 0).toFixed(2)}`,
  },
  {
    group: "Saturation and noise",
    key: "eps",
    symbol: "εₙ",
    name: "Cubic thermocline saturation",
    min: 0,
    max: 8,
    step: 0.1,
    digits: 1,
    sentence:
      "Stops a very deep or very shallow thermocline from warming or cooling the east without limit. Zero is Jin’s linear oscillator.",
    gloss: (p) => (p.eps === 0 ? "linear model" : "nonlinear (3.1)"),
  },
  {
    group: "Saturation and noise",
    key: "sig1",
    symbol: "σ₁²",
    name: "Wind noise",
    min: 0,
    max: 0.4,
    step: 0.005,
    digits: 3,
    sentence:
      "Random wind. It shakes the western thermocline and, through the tilt, the SST. Zero is the deterministic model.",
    gloss: (p) => (p.sig1 === 0 ? "off" : "ξ₁ on"),
  },
  {
    group: "Saturation and noise",
    key: "sig2",
    symbol: "σ₂²",
    name: "Heating noise",
    min: 0,
    max: 0.4,
    step: 0.005,
    digits: 3,
    sentence:
      "Random heating of the eastern Pacific. Jin’s illustrated variance is 2/15, about 1°C per month of white noise. Zero turns it off.",
    gloss: (p) => (Math.abs(p.sig2 - 2 / 15) < 0.01 ? "Jin’s 2/15" : p.sig2 === 0 ? "off" : "ξ₂ on"),
  },
];

export const TERM_SPEC = [
  { id: "bjerknes", eq: "R T_E", meaning: "Bjerknes feedback on the east" },
  { id: "thermocline", eq: "γ h_W", meaning: "thermocline effect from the west" },
  { id: "cubic", eq: "−εₙ h_E³", meaning: "saturation of that feedback" },
  { id: "memory", eq: "−r h_W", meaning: "western thermocline relaxing" },
  { id: "sverdrup", eq: "−α b T_E", meaning: "wind draining or piling heat" },
];

export const CONTROL_GROUPS = ["Coupling", "Ocean memory", "Saturation and noise"];
