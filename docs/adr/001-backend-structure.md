# ADR 001 — Backend Structure

## Decision

For the current stage of the project, `backend/src/` will continue to follow the existing flat structure.

New backend work should generally be added under:

```
backend/src/routes/<domain>.ts
```

with each route file exporting a function such as:

```ts
register<Domain>Routes(app)
```

Reusable business logic may be placed in plain modules under:

```
backend/src/services/
```

At this stage, we will not introduce additional architectural layers such as:

```
modules/
controllers/
repositories/
models/
interfaces/
```

This decision is primarily intended to maintain consistency across the repository and avoid introducing multiple backend conventions at the same time.

## Context

Two currently open PRs independently introduce more layered backend structures:

**#242 — R-7 Certification Engine**

Introduces a domain-oriented structure under:

```
modules/certification/
```

including services, repositories, models, interfaces, and checks, along with additional top-level `interfaces/` and `models/` directories.

**#391 — Remediation**

Introduces a more traditional layer-oriented structure using top-level:

```
controllers/
models/
interfaces/
```

Both approaches are reasonable architectural choices in isolation. However, they follow different conventions from each other as well as from the structure currently used in `main`.

At present, `main` primarily follows the `backend/src/routes/` pattern, with route files exporting `register...Routes(app)` functions that are registered through `index.ts`.

## Reasons

### 1. We should avoid introducing multiple competing conventions

The two proposed structures are both valid approaches, but they organise code differently.

One is primarily domain-based, while the other is layer-based.

If both are merged without a repository-wide architectural decision, we may end up maintaining three different patterns simultaneously:

- Existing flat `routes/`
- Domain-based `modules/`
- Layer-based `controllers/` / `models/` / `interfaces/`

This may make it difficult for future contributors to know where new functionality should be placed.

For now, keeping the existing convention gives contributors one clear and consistent answer.

### 2. We should avoid introducing a parallel database abstraction unintentionally

The backend currently uses the native MongoDB driver through `MongoClient`, with database access provided through `dbStore` in `backend/src/db.ts`.

Both proposed structures also introduce Mongoose-based models.

Using the native MongoDB driver and Mongoose side by side is technically possible, but doing so without a repository-wide migration plan could create two separate approaches for reading and writing the same data.

This may eventually raise questions around:

- Which access layer should be considered authoritative
- How transactions should be handled consistently
- Which abstraction new contributors should use
- How schema and data-access behaviour stay aligned

There is also a dependency-management concern worth noting: `backend/package.json` currently declares `mongodb`, while `mongoose` is declared at the root level. As a result, backend Mongoose imports currently depend on workspace dependency resolution rather than a backend-local declaration.

This is not necessarily incorrect, but it is another reason to make the database architecture an explicit decision rather than allowing it to evolve incrementally across individual PRs.

### 3. Some benefits of additional layers will become more valuable once testing is stronger

One of the strongest advantages of repository and service layers is the ability to test business and data-access logic independently.

At present, the backend has a limited automated test suite.

Because of this, we would be taking on the additional structural complexity immediately while not yet receiving the full testing and isolation benefits that normally justify it.

This does not mean repository or controller layers are unsuitable for the project. It simply means their value may be clearer once the testing infrastructure is mature enough to make use of them effectively.

### 4. A structural change should ideally be repository-wide

If we decide to adopt a layered architecture, it would be better to do so intentionally across the backend rather than one feature at a time.

The repository already contains a substantial number of existing route files.

Without a planned migration, introducing a second architecture for only new features could leave both structures in place for a long period of time.

A repository-wide architectural change should therefore ideally be discussed, planned, and migrated consistently.

## Consequences

For upcoming work:

- New route-level functionality should continue to be placed under `backend/src/routes/`.
- Shared or reusable business logic may be placed under `backend/src/services/`.
- Data access should continue through the existing `dbStore` mechanism.
- PRs introducing additional architectural layers may be requested to adapt their implementation to the existing `routes/` and `services/` structure.
- Contributors should have one consistent convention for deciding where backend code belongs.

This is not intended as a criticism of the layered implementations proposed in the existing PRs. Both contain useful design ideas. The objective is simply to avoid adopting multiple architectural conventions before the repository has made a deliberate decision about them.

## Reference Implementation

A useful example is `vicharanashala/tenali#173`.

That work modularised a large `server/index.js` into grouped route files while preserving a relatively simple architecture and adding API contract coverage.

It demonstrates that meaningful modularisation can still be achieved without necessarily introducing additional architectural layers or a second database abstraction.

## When We Should Revisit This Decision

This ADR should be reconsidered when there is a clear technical reason for the current structure to evolve.

Two useful signals would be:

### 1. A meaningful backend test suite is in place

Once the backend has stronger automated test coverage, repository and service isolation may provide significantly more practical value.

At that point, introducing additional layers may be worth reconsidering.

### 2. Individual route files become difficult to maintain

If a route file grows substantially — for example, to around 800 lines or beyond — that may indicate that the current structure is beginning to strain.

At that stage, we should evaluate whether additional domain or architectural separation would improve maintainability.

These are intended as practical signals rather than strict limits.

General preferences such as "this structure feels cleaner" may not, by themselves, justify the migration cost. However, measurable maintainability or testing needs would be good reasons to reopen the discussion.

Any future discussion can reference this ADR so that the decision is revisited with full context.

## Not Decided Here

This ADR does not decide whether Mongoose should eventually replace the native MongoDB driver across the repository.

That is a separate architectural decision and should be evaluated independently based on its own benefits, migration cost, testing implications, and long-term maintenance requirements.

The only decision being made here is that the project should avoid gradually introducing two different database-access approaches through individual PRs without first making that repository-wide choice explicitly.
