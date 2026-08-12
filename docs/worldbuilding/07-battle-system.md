# Battle System — Grain, Grafts, Sap, Scars

Design goal: combat should feel like the same verb as investigation. You are reading a
structure, predicting how it will grow, and committing to interventions before you know
whether they will land.

Explicitly **not** present: elemental typing, MP bars per character, damage-race
attrition, "attack until the number is zero."

---

## 1. Grain — the weakness system that consumes itself

Every combatant has a **Grain**: a structural fibre direction on a four-position dial.

```
        RISING (0)
            │
COMPACTED(3)─┼─LATERAL (1)
            │
       TWISTED (2)
```

Every action also has a Grain — the direction it applies force along.

Let `d = (target.grain - action.grain + 4) % 4`.

| `d` | Relationship | Effect |
|---|---|---|
| 2 | **Across the grain** | ×1.75 damage. Splits fibre. |
| 1 or 3 | Oblique | ×1.0 |
| 0 | **Along the grain** | ×0.25, and the target **gains Sap** — force along the fibre is absorbed as growth. Feeding the enemy. |

**The rule that makes it a system:** any action that connects **rotates the target's
Grain by +1**.

So exploiting a weakness *destroys that weakness*. You cannot chain across-grain hits
with one character. The optimal line is a rotation dance in which each party member's
action-Grain covers the position the previous member's hit created — combat as
call-and-response, which is also what cant-singing is.

Grain is hidden until **Read** (see §4). Attacking blind risks feeding the target.

---

## 2. Sap — one shared pool

There is no per-character MP. The party shares a single **Sap** pool.

- Modest cap (~12), regenerating a small fixed amount per round.
- Every graft, read, and technique draws from it.
- **Burn Heartwood:** any character may pay HP instead of Sap at a punitive rate.
  Heartwood burned this way leaves a Scar.

A shared pool means every action is an argument about allocation between four people
who disagree about strategy. That is the whole setting in one resource bar.

---

## 3. Grafts — commit before you know

Grafts are the primary offensive and supportive verb. A graft is **placed** on a target
with a **maturity timer**, and does nothing until it matures.

```
  place ──▶ [ maturing: 2 ] ──▶ [ maturing: 1 ] ──▶ ✦ MATURE: full effect
              │                      │
              └── harvest early ─────┘   (partial effect, immediate)
              └── excised by enemy ──▶   (wasted entirely)
```

- **Mature** — full effect, applied automatically.
- **Harvest early** — cash out for a reduced immediate effect. Costs a turn.
- **Excise** — enemies can cut an immature graft out. The investment is lost.

Design consequence: the tension curve of every fight is *unrealised investment*. A party
with four maturing grafts on the board is powerful and fragile at the same time, and the
decision to harvest early is the decision Stillwood and the Splicers are arguing about
at civilizational scale.

Grafts stack, but each additional graft on one target reduces the whole stack's maturity
reliability — over-grafting is how Marrow got sick.

---

## 4. Read — information as an action

The Cant-singer's **Read** spends Sap to expose, for one target:

- current Grain and its rotation history,
- every placed graft and its exact maturity timer,
- accumulated Scars and what they are vulnerable to.

A Read target stays revealed for the rest of the encounter. Spending an early turn on
information rather than damage is almost always correct, and the game should never
apologise for that — it is what the party does for a living.

---

## 5. Scars — damage that means something

Large hits and burned heartwood leave **Scars**. A Scar:

- permanently (for the encounter) lowers the victim's maximum HP,
- **locks the Grain rotation** at that position — a scarred fibre cannot turn,
- is **readable**, and a Read scar can be targeted for bonus effect.

Locked Grain is the key interaction: scarring an enemy stops the rotation dance and lets
a single character chain across-grain hits. So the tactical arc of a hard fight is
*scar it, then exploit the frozen weakness* — which is, note, exactly the moral logic of
Pruning. The system should let the player feel good about that and then think about it
later.

---

## 6. Role kits

| Role | Grain skew | Signature |
|---|---|---|
| **Cant-singer** (Wend) | all four, weak damage | `Read`; rewrite a graft's maturity timer up or down |
| **Graft-medic** (Pell) | Rising / Lateral | restorative grafts; `Excise` hostile grafts |
| **Coring** (Tarn) | Compacted | heavy across-grain force; deliberately takes Scars to protect others |
| **Windreader** (Kite) | Twisted / Lateral | previews next round's enemy actions; forces Grain rotation without damage |

Kite's forced rotation is the pressure valve: she can spin a target into the position the
next character needs, which turns a four-person turn order into a puzzle with a solution
rather than a stat check.

---

## 7. What victory looks like

Encounters end when a structure is no longer viable, not when a number reaches zero.
Most non-boss encounters should be resolvable by **rendering the opponent structurally
unable to continue** — enough Scars, enough locked Grain — which reads as the same
professional judgement the party applies to a sick Strider.

There is no final boss (`00-design-principles.md`). The last act's encounters are
against weather, structure, and time.
