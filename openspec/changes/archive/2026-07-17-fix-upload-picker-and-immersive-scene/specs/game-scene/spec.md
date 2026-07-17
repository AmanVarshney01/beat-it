# game-scene

## ADDED Requirements

### Requirement: Scene is immersive with the face as focal point

The game scene SHALL occupy the full viewport (covering app chrome) and SHALL size the head so it is the dominant visual element, with fist and effect sizes scaling proportionally to the head.

#### Scenario: Game starts

- **WHEN** the game scene is shown
- **THEN** it covers the entire viewport and the head's diameter is at least half of the viewport's smaller dimension

#### Scenario: Viewport resized

- **WHEN** the viewport size changes
- **THEN** the head, dummy, and effects rescale so the face remains the dominant element
