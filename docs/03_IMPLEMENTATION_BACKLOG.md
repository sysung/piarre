# Implementation backlog

[GitHub Project 8](https://github.com/users/sysung/projects/8/views/1) and its linked issues are the authoritative backlog. They own scope, dependencies, priority, estimates, status, acceptance criteria, and delivery evidence. This document does not duplicate that changing information.

The [first integrated Piarre release epic](https://github.com/sysung/piarre/issues/51) groups the current work. Its [baseline work package](https://github.com/sysung/piarre/issues/52) contains the immediate implementation and verification plan.

Keep requirements in the [PRD](01_PRODUCT_PRD.md) and architecture in the [technical design](02_TECHNICAL_DESIGN.md). Work-specific plans, historical snapshots, experiments, and run reports belong in `.artifacts` or their issue and PR. Promote only lasting conclusions into the existing documents.

The C release replaces the old B delivery sequence. Superseded issues remain traceable in GitHub. Internal work remains incremental and verified; the user reviews one coherent candidate rather than every implementation item.

The selected [Design B session brief](https://www.figma.com/design/I7CeHDqFJEvoEdmslfKrNp?node-id=7-2) enters implementation through [C02’s workspace slice](https://github.com/sysung/piarre/issues/64), under [C02](https://github.com/sysung/piarre/issues/53). C03 owns sourced resumption and memory, C04 owns execution and outcome review, and C08 owns integrated validation. The linked issues retain the changing acceptance details. “Design B” names the chosen UI direction and does not reactivate the retired B delivery sequence.
