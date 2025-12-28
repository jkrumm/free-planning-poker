import { TypeCompiler } from '@sinclair/typebox/compiler';
import { t, type Static } from 'elysia';

export const BaseActionSchema = t.Object({
  userId: t.String({
    min: 21,
    max: 21,
  }),
  roomId: t.Number({
    minimum: 1,
  }),
});

/**
 * ActionSchemas
 */

/** Estimate action schema */
export const EstimateActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('estimate'),
    estimation: t.Nullable(t.Number()),
  }),
]);
export type EstimateAction = Static<typeof EstimateActionSchema>;

export function isEstimateAction(action: unknown): action is EstimateAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    action.action === 'estimate'
  );
}

/** SetSpectator action schema */
export const SetSpectatorActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('setSpectator'),
    isSpectator: t.Boolean(),
    targetUserId: t.String({
      min: 21,
      max: 21,
    }),
  }),
]);
export type SetSpectatorAction = Static<typeof SetSpectatorActionSchema>;

export function isSetSpectatorAction(
  action: unknown
): action is SetSpectatorAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    action.action === 'setSpectator'
  );
}

/** Reset action schema */
export const ResetActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('reset'),
  }),
]);
export type ResetAction = Static<typeof ResetActionSchema>;

export function isResetAction(action: unknown): action is ResetAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    action.action === 'reset'
  );
}

/** SetAutoFlip action schema */
export const SetAutoFlipActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('setAutoFlip'),
    isAutoFlip: t.Boolean(),
  }),
]);
export type SetAutoFlipAction = Static<typeof SetAutoFlipActionSchema>;

export function isSetAutoFlipAction(
  action: unknown
): action is SetAutoFlipAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    action.action === 'setAutoFlip'
  );
}

/** Leave action schema */
export const LeaveActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('leave'),
  }),
]);
export type LeaveAction = Static<typeof LeaveActionSchema>;

export function isLeaveAction(action: unknown): action is LeaveAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    action.action === 'leave'
  );
}

/** Flip action schema */
export const FlipActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('flip'),
  }),
]);
export type FlipAction = Static<typeof FlipActionSchema>;

export function isFlipAction(action: unknown): action is FlipAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    action.action === 'flip'
  );
}

/** Change Username action schema */
export const ChangeUsernameActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('changeUsername'),
    username: t.String(),
  }),
]);
export type ChangeUsernameAction = Static<typeof ChangeUsernameActionSchema>;

export function isChangeUsernameAction(
  action: unknown
): action is ChangeUsernameAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    action.action === 'changeUsername'
  );
}

/** Change Room Name action schema */
export const ChangeRoomNameActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('changeRoomName'),
    roomName: t.String(),
  }),
]);
export type ChangeRoomNameAction = Static<typeof ChangeRoomNameActionSchema>;

export function isChangeRoomNameAction(
  action: unknown
): action is ChangeRoomNameAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    action.action === 'changeRoomName'
  );
}

/** Heartbeat action schema */
export const HeartbeatActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('heartbeat'),
  }),
]);
export type HeartbeatAction = Static<typeof HeartbeatActionSchema>;

export function isHeartbeatAction(action: unknown): action is HeartbeatAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    action.action === 'heartbeat'
  );
}

/** Rejoin action schema */
export const RejoinActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('rejoin'),
    username: t.String(),
  }),
]);
export type RejoinAction = Static<typeof RejoinActionSchema>;

export function isRejoinAction(action: unknown): action is RejoinAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    action.action === 'rejoin'
  );
}

export const SetPresenceActionSchema = t.Object({
  action: t.Literal('setPresence'),
  roomId: t.Number(),
  userId: t.String(),
  isPresent: t.Boolean(),
});

export type SetPresenceAction = Static<typeof SetPresenceActionSchema>;

export function isSetPresenceAction(data: unknown): data is SetPresenceAction {
  return (
    typeof data === 'object' &&
    data !== null &&
    'action' in data &&
    data.action === 'setPresence'
  );
}

/** Kick action schema */
export const KickActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('kick'),
    targetUserId: t.String({
      min: 21,
      max: 21,
    }),
  }),
]);
export type KickAction = Static<typeof KickActionSchema>;

export function isKickAction(action: unknown): action is KickAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    action.action === 'kick'
  );
}

/**
 * Action schema union
 */
export const ActionSchema = t.Union([
  HeartbeatActionSchema,
  EstimateActionSchema,
  SetSpectatorActionSchema,
  ResetActionSchema,
  SetAutoFlipActionSchema,
  LeaveActionSchema,
  RejoinActionSchema,
  ChangeUsernameActionSchema,
  ChangeRoomNameActionSchema,
  FlipActionSchema,
  SetPresenceActionSchema,
  KickActionSchema,
]);

// Static t for ActionSchema
export type Action = Static<typeof ActionSchema>;

// Compile the schema
export const CActionSchema = TypeCompiler.Compile(ActionSchema);
