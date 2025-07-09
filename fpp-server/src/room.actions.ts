// @ts-ignore

import { TypeCompiler } from '@sinclair/typebox/compiler';
// @ts-ignore
import { Static, t } from 'elysia';

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

export function isEstimateAction(action: any): action is EstimateAction {
  return action.action === 'estimate';
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
  action: any
): action is SetSpectatorAction {
  return action.action === 'setSpectator';
}

/** Reset action schema */
export const ResetActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('reset'),
  }),
]);
export type ResetAction = Static<typeof ResetActionSchema>;

export function isResetAction(action: any): action is ResetAction {
  return action.action === 'reset';
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

export function isSetAutoFlipAction(action: any): action is SetAutoFlipAction {
  return action.action === 'setAutoFlip';
}

/** Leave action schema */
export const LeaveActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('leave'),
  }),
]);
export type LeaveAction = Static<typeof LeaveActionSchema>;

export function isLeaveAction(action: any): action is LeaveAction {
  return action.action === 'leave';
}

/** Flip action schema */
export const FlipActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('flip'),
  }),
]);
export type FlipAction = Static<typeof FlipActionSchema>;

export function isFlipAction(action: any): action is FlipAction {
  return action.action === 'flip';
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
  action: any
): action is ChangeUsernameAction {
  return action.action === 'changeUsername';
}

/** Heartbeat action schema */
export const HeartbeatActionSchema = t.Intersect([
  BaseActionSchema,
  t.Object({
    action: t.Literal('heartbeat'),
  }),
]);
export type HeartbeatAction = Static<typeof HeartbeatActionSchema>;

export function isHeartbeatAction(action: any): action is HeartbeatAction {
  return action.action === 'heartbeat';
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

export function isRejoinAction(action: any): action is RejoinAction {
  return action.action === 'rejoin';
}

export const SetPresenceActionSchema = t.Object({
  action: t.Literal('setPresence'),
  roomId: t.Number(),
  userId: t.String(),
  isPresent: t.Boolean(),
});

export type SetPresenceAction = Static<typeof SetPresenceActionSchema>;

export function isSetPresenceAction(data: any): data is SetPresenceAction {
  return data.action === 'setPresence';
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

export function isKickAction(action: any): action is KickAction {
  return action.action === 'kick';
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
  FlipActionSchema,
  SetPresenceActionSchema,
  KickActionSchema,
]);

// Static t for ActionSchema
export type Action = Static<typeof ActionSchema>;

// Compile the schema
export const CActionSchema = TypeCompiler.Compile(ActionSchema);