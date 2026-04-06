# Multiplayer classroom scenarios

QuantumGrasp’s **multiplayer** mode is a **local, in-room activity**: a **teacher** hosts on one phone (Bluetooth + Wi‑Fi, no accounts), and **students** join as nearby peers. The teacher picks a **scenario**, waits until enough players are connected, then **starts the exercise**. Everyone sees a shared **scenario screen**; the teacher also has a **debug-style summary** of room state (bits, verification flags, sift estimates).

This document explains **what each scenario is** in quantum-information terms and **what the app is trying to teach** through the simplified game mechanics.

---

## What the “game” is

- **Roles:** Students are assigned **Alice**, **Bob**, or (in one scenario) **Eve** in connection order. The **host** is the instructor and does not take a player role; they control advertising, scenario choice, hints, start/pause/reset, and can read aggregated state.
- **Pedagogy:** The goal is to make abstract protocols **tangible**: entangled correlations, classical communication in teleportation, and the **detection** of eavesdropping—without requiring students to program simulators during the activity.
- **Simplifications:** The scenarios are **educational demos**. They use host-mediated state and, where noted, **randomized or symbolic** steps to stand in for full quantum tomography or a full BB84 round trip. Use them to **motivate discussion** and link back to your lecture or to on-device circuits in the main app.

---

## Scenario A — “Spooky (Bell)”

### What it is (quantum ideas)

- A **Bell pair** is a maximally entangled two-qubit state (often \(\lvert \Phi^+ \rangle = \frac{1}{\sqrt{2}}(\lvert 00 \rangle + \lvert 11 \rangle)\) in some convention).
- If Alice and Bob each hold one qubit of that pair and both **measure in the computational basis**, their **outcomes are correlated**: they always get the **same** bit (for \(\lvert \Phi^+ \rangle\) in the standard textbook setup). That **non-classical correlation** is what people colloquially call “**spooky action at a distance**” (Einstein’s phrase)—though no usable information travels faster than light in this setup.

### What the app does

- When the teacher starts the exercise, the UI indicates that a **Bell pair is “ready”** (lesson framing).
- **Alice** taps **“Measure my qubit.”** The app draws a **random 0/1** using the **local circuit simulator’s probability for qubit 0** (`getQubitProbs`) as a teaching stand-in for a measurement outcome—not a full density-matrix simulation of a shared Bell state on two devices.
- The **host** records Alice’s bit and sets **Bob’s displayed outcome** to the **same** bit, so Bob’s phone shows the **correlated** result.
- **Teaching point:** Students **feel** the story: Alice’s action is associated with Bob’s outcome **without** Bob choosing locally—good for discussing **entanglement**, **measurement correlations**, and why this still does not allow **superluminal signaling** (Bob’s outcome looks random until they compare notes classically).

---

## Scenario B — “Teleport”

### What it is (quantum ideas)

- **Quantum teleportation** transfers the **state of one qubit** to another using a **shared entangled pair** and **two classical bits** from Alice to Bob. Bob applies one of four **Pauli corrections** \(\{I, X, Z, Y\}\) depending on Alice’s measurement outcome.

### What the app does

- The narrative assumes **shared entanglement** is already in place; the exercise focuses on the **classical side** and **Bob’s correction**.
- **Alice** sets two **classical bits** (bit 0 and bit 1) and taps **“Send classical bits.”** Those two bits stand in for the **pair of classical bits** that would come from Alice’s Bell measurement in a real teleportation protocol.
- **Bob** sees the transmitted bits and a **cheat sheet**: **00 → I**, **01 → X**, **10 → Z**, **11 → Y** (standard teaching labels). Bob taps the matching **Pauli** “gate.”
- The **host** checks whether Bob’s choice matches the **expected correction** derived from the two bits (`expectedTeleportCorrection` in code). The UI shows **“State reconstructed!”** or **“Try again.”**
- **Teaching point:** Reinforces that **entanglement alone is not enough**—you need **classical communication**; and that the correction is a **finite set of operations** determined by the classical message.

---

## Scenario C — “BB84” (spy game)

### What it is (quantum ideas)

- **BB84** is a **quantum key distribution** protocol: Alice sends qubits in random bases; Bob measures in random bases; they **sift** to keep rounds where bases match, then check error rates. If an **eavesdropper (Eve)** intercepts and measures, she disturbs the states in a way that tends to **raise the error rate** on sifted bits—so honest parties can **detect** tampering.

### What the app does

- This is a **dramatized classroom game**, not a full BB84 simulation. Alice and Bob mainly **watch the teacher screen** for outcomes; **Eve** has an **intercept window** (timed).
- While the window is **active**, **Eve** can tap **“Intercept (measure).”** If Eve intercepts, the room marks the round as **unsafe**; after the window closes, the host computes a **demo “sift error estimate”** (high if Eve acted, low if not—see implementation in `multiplayerSessionStore`).
- The UI surfaces **“Connection unsafe — eavesdropper detected!”** vs a calmer message when no strong signature appears—in **demo** form for discussion.
- **Teaching point:** Links **physical interception** to **detectable disturbance** in QKD stories, and motivates why **privacy amplification** and full protocol details matter in real systems—even though this app only illustrates the **narrative**.

---

## Summary table

| Scenario | Label in app | Core concept | Student takeaway |
|----------|----------------|--------------|------------------|
| **A** | Spooky (Bell) | Entanglement & correlated measurement outcomes | Same-bit correlation without local copying; “spooky” ≠ signaling |
| **B** | Teleport | Classical bits + correction after entanglement | Teleportation needs **two classical bits** and a **Pauli fix** |
| **C** | BB84 | QKD & eavesdropper detection | Interception can leave **footprints** (error / unsafe flags in the demo) |

---

## See also

- In-app flow: **Multiplayer** from the circuit screen header → **Host session** or **Join nearby** → teacher starts a scenario.
- Implementation: `src/screens/multiplayer/`, `src/services/multiplayer/`.

*QuantumGrasp — KSU Quantum Security Lab.*
