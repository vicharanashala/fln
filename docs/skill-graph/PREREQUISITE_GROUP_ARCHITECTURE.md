# AND/OR Prerequisite Group Architecture & Traversal Specification

**Document Status:** Architectural Specification  
**Issue Reference:** Closes #466 (reconciled with #523 & #351)  
**Implementation Source:** `backend/src/competencyPrerequisites.ts`  

---

## 1. Executive Summary

Traditional prerequisite representations use a flat list of parent nodes for each concept, implicitly evaluating them as a strict **AND** (all prerequisites required). In Knowledge Space Theory (Falmagne et al., 1990) and real curriculum learning trajectories, a concept can often be reached via **alternative minimal prerequisite sets** (clause groups, evaluated as **OR-of-ANDs**).

This specification documents the production AND/OR prerequisite group architecture, graph-traversal semantics, governance policy, and reconciliation roadmap with persistent schema storage.

---

## 2. Data Model & Schema

The prerequisite model in `backend/src/competencyPrerequisites.ts` models alternative routes via explicit `PrerequisiteGroup` overrides while falling back to implicit single-group AND sets for standard concepts.

```typescript
export type PrerequisiteGroupType = 'AND' | 'OR';
export type PrerequisiteGroupStatus = 'PROPOSED' | 'VALIDATED' | 'DEPRECATED';
export type PrerequisiteRelationshipType = 'HARD_PREREQUISITE' | 'RECOMMENDED' | 'SEQUENCE';

export interface PrerequisiteGroup {
  groupId: string;
  type: PrerequisiteGroupType;       // AND (all members required) or OR
  memberIds: readonly string[];      // conceptIds in this group
  relationshipType: PrerequisiteRelationshipType;
  status: PrerequisiteGroupStatus;   // PROPOSED, VALIDATED, DEPRECATED
  rationale?: string;
  evidence?: PrerequisiteEvidence;   // NCF_FS | NIPUN | EXPERT | PILOT_DATA | RESEARCH
}
```

---

## 3. Graph Traversal & Satisfaction Logic

A concept $C$ is satisfied under a learner's mastered set $M$ if **at least one** validated hard-prerequisite group has all of its members mastered:

$$\text{isPrerequisiteSatisfied}(C, M) = \bigvee_{g \in \text{Groups}(C)} \left( \bigwedge_{m \in g.\text{members}} m \in M \right)$$

### Resolver Functions

1. **`prerequisiteGroups(conceptId)`**:  
   Returns the proposed override groups if present in `CONCEPT_PREREQUISITE_GROUP_OVERRIDES`; otherwise returns the implicit single AND group derived from `CONCEPT_PREREQUISITES`. Used for curriculum review and teaching-plan visualizations.

2. **`effectiveHardPrerequisiteGroups(conceptId)`**:  
   Returns only `VALIDATED` groups with `relationshipType: 'HARD_PREREQUISITE'`. Proposed overrides gate no student until validated by curriculum lead sign-off.

3. **`isPrerequisiteSatisfied(conceptId, masteredSet)`**:  
   Evaluates whether `masteredSet` satisfies any effective hard prerequisite group for `conceptId`.

---

## 4. Worked Reference Case: `S5.8` (Multiplication Tables)

Multiplication Tables (`S5.8`) is reachable via two distinct, valid pedagogical routes:
- **Route 1 (`g1`):** Skip-Counting Fluency (`S5.19`)
- **Route 2 (`g2`):** Multiplication as Repeated Addition (`S5.6`)

```typescript
export const CONCEPT_PREREQUISITE_GROUP_OVERRIDES = {
  'S5.8': [
    {
      groupId: 'g1',
      type: 'AND',
      memberIds: ['S5.19'],
      relationshipType: 'HARD_PREREQUISITE',
      status: 'PROPOSED',
      rationale: 'Route 1 — skip-counting fluency (S5.19).',
      evidence: { sourceType: 'EXPERT', reference: 'fln#523' },
    },
    {
      groupId: 'g2',
      type: 'AND',
      memberIds: ['S5.6'],
      relationshipType: 'HARD_PREREQUISITE',
      status: 'PROPOSED',
      rationale: 'Route 2 — multiplication as repeated addition (S5.6).',
      evidence: { sourceType: 'EXPERT', reference: 'fln#523' },
    },
  ],
};
```

---

## 5. Governance & Policy Rules

1. **Default flat-AND:** Every concept defaults to a single AND group.
2. **No override on assumption:** Concepts like `S5.4` (`['S4.6', 'S5.2']`) and `S6.5` (`['S5.4', 'S5.5', 'S6.1']`) remain flat AND until teacher elicitation confirms an alternative route.
3. **Curriculum Lead Approval:** Transitioning group status from `PROPOSED` to `VALIDATED` requires explicit sign-off from the curriculum lead.
4. **Safety & Fallback:** Unapproved or proposed overrides gate no students and fall back safely to existing validated prerequisite requirements.

---

## 6. Reconciliation Roadmap with #351 (`concept_edges`)

Future persistent database storage for `concept_edges` (#351) will store edge groups using a nullable `clause_id` / `group_id` foreign key:

| Field | Type | Description |
|---|---|---|
| `edge_id` | String (PK) | Unique edge identifier |
| `source_concept_id` | String | Prerequisite concept (e.g. `S5.6`) |
| `target_concept_id` | String | Target concept (e.g. `S5.8`) |
| `clause_id` | String | Group identifier (`g1`, `g2`) mapping to an OR clause |
| `relationship_type` | String | `HARD_PREREQUISITE` \| `RECOMMENDED` \| `SEQUENCE` |
| `status` | String | `PROPOSED` \| `VALIDATED` \| `DEPRECATED` |

This mapping aligns the in-memory TypeScript override system cleanly with future persistent graph storage.
