/**
 * Minimal, dependency-free finite state machine helper.
 *
 * Why this exists: flows such as "mine → gained → idle" or
 * "sign → broadcast → confirm" used to be encoded as scattered
 * `setState("...")` calls, boolean flags and `setTimeout`s. That makes illegal
 * states representable (e.g. trading *while* claiming) and lets stale timers
 * clobber newer state. A transition table makes every legal move explicit,
 * reviewable in one place, and unit-testable without React or a wallet.
 *
 * The API is intentionally tiny (no actors, no context) so it can be adopted
 * incrementally. See docs/STATE-MACHINES.md for the full inventory.
 */

export type TransitionTable<S extends string, E extends string> = {
  readonly [State in S]: { readonly [Event in E]?: S }
}

export interface MachineConfig<S extends string, E extends string> {
  /** Used in dev warnings so an ignored event can be traced to its machine. */
  readonly id: string
  readonly initial: S
  readonly states: TransitionTable<S, E>
}

export interface Machine<S extends string, E extends string> {
  readonly id: string
  readonly initial: S
  readonly states: TransitionTable<S, E>
  /** True when `event` is a legal move out of `state`. */
  can(state: S, event: E): boolean
  /**
   * Next state for `event`. Illegal events are ignored and the *same* state is
   * returned, so callers can compare by identity to detect a rejected event.
   */
  transition(state: S, event: E): S
  /** Events that are legal from `state` (handy for tests and debugging). */
  events(state: S): E[]
}

export function createMachine<S extends string, E extends string>(
  config: MachineConfig<S, E>,
): Machine<S, E> {
  const { id, initial, states } = config

  const next = (state: S, event: E): S | undefined => {
    const row = states[state] as { readonly [Event in E]?: S } | undefined
    return row ? row[event] : undefined
  }

  return {
    id,
    initial,
    states,
    can: (state, event) => next(state, event) !== undefined,
    transition: (state, event) => next(state, event) ?? state,
    events: (state) => Object.keys(states[state] ?? {}) as E[],
  }
}
