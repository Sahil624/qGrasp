# Student exercises — QuantumGrasp

Short problems you can solve **on paper** and **in the app** (build the circuit and compare with the probability readout). Assume every qubit starts in \(|0\rangle\) unless stated otherwise.

---

## Exercise 1 — Superposition (easy)

**Goal:** Connect the Hadamard gate to measurement statistics.

1. Use **one** qubit. Apply **H** to that qubit.
2. In Dirac notation, what is the state just before measurement?
3. If you measured in the computational basis \(\{|0\rangle, |1\rangle\}\), what is the probability of outcome **0**? Of **1**?
4. Build the same circuit in QuantumGrasp and check whether the displayed probabilities match your answers.

**Stretch (optional):** Apply **H** twice in a row before measuring. What should the outcome be with certainty, and why?

---

## Exercise 2 — A Bell state (easy to moderate)

**Goal:** Practice a two-qubit entangling pattern: **H** + **CNOT** (CX).

1. Use **two** qubits, \(q_0\) and \(q_1\).
2. Apply **H** on \(q_0\), then **CX** with **control** \(q_0\) and **target** \(q_1\) (same order you would read left-to-right on a diagram).
3. Write the joint state of the two qubits as a linear combination of \(|00\rangle\), \(|01\rangle\), \(|10\rangle\), and \(|11\rangle\).
4. If you could measure **both** qubits in the computational basis many times, which outcomes would you **never** see for this circuit?
5. Rebuild the circuit in QuantumGrasp. Do the probabilities for \(|00\rangle\) and \(|11\rangle\) match what you derived?

---

## Exercise 3 — Equivalent sequences (moderate)

**Goal:** See how single-qubit gates **compose**, and test an identity with the simulator.

1. Still on **one** qubit starting in \(|0\rangle\).
2. **Circuit A:** apply **H**, then **Z**, then **H** (in that order).
3. **Circuit B:** apply a single **X** to the qubit.
4. Using linear algebra or the Bloch-sphere picture, argue that **Circuit A** and **Circuit B** send \(|0\rangle\) to the **same** state.
5. Implement both circuits in QuantumGrasp (you may need two separate trials or clear the circuit between them). Compare the **measurement probabilities** for each—what do you observe?

**Hint:** You do not need to multiply full \(2 \times 2\) matrices if you already know how **H**, **Z**, and **X** act on \(|0\rangle\) and \(|1\rangle\).

---

## Answer key (for instructors)

| Exercise | Short answer |
|----------|----------------|
| **1** | After one **H**, state is \(\frac{1}{\sqrt{2}}(|0\rangle + |1\rangle)\); \(P(0)=P(1)=\frac{1}{2}\). After **H H**, state returns to \(|0\rangle\); \(P(0)=1\). |
| **2** | Standard Bell \(|\Phi^+\rangle = \frac{1}{\sqrt{2}}(|00\rangle + |11\rangle)\). Never \(|01\rangle\) or \(|10\rangle\). Ideally \(P(|00\rangle)=P(|11\rangle)=\frac{1}{2}\). |
| **3** | **HZH** acts as **X** on the Bloch sphere; both take \(|0\rangle \mapsto |1\rangle\), so \(P(1)=1\) in the computational basis (up to numerical/display rounding in the app). |

---

*These exercises match the gate set in QuantumGrasp (e.g. **H**, **X**, **Z**, **CX**). Adjust qubit indices in the UI to match the exercise notation.*
