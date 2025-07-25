'use client';

import React from 'react';

import { Card } from '@mantine/core';

import { type Action } from 'fpp-server/src/room.actions';
import { RoomStateStatus, type User } from 'fpp-server/src/room.entity';
import { AnimatePresence, motion } from 'framer-motion';

import { useRoomStore } from 'fpp/store/room.store';

import { CardListCardPlace } from './card-list-card-place';
import { UserHoverCard } from './user-hover-card';

export interface CardListProps {
  roomId: number;
  userId: string;
  triggerAction: (action: Action) => void;
}

export const CardList = ({ roomId, userId, triggerAction }: CardListProps) => {
  const users = useRoomStore((store) => store.users);
  const status = useRoomStore((store) => store.status);

  // Filter out spectators
  const playersOnly = users.filter((user) => !user.isSpectator);

  // Sort users: estimated (green) first, then unestimated (red)
  const sortedUsers = [...playersOnly].sort((a, b) => {
    const aHasEstimation = a.estimation !== null;
    const bHasEstimation = b.estimation !== null;

    if (aHasEstimation && !bHasEstimation) return -1;
    if (!aHasEstimation && bHasEstimation) return 1;
    return 0;
  });

  return (
    <div className="p-0 pt-2 md:pt-0 pl-2 md:pl-3 pb-2 md:mt-2 max-w-full w-full scrollbar-hide overflow-y-scroll overflow-x-hidden h-[calc(100vh-160px)] md:h-[calc(100vh-230px)]">
      <div className="flex">
        <div className="flex-1">
          <CardListCardPlace
            roomId={roomId}
            userId={userId}
            users={users}
            status={status}
            triggerAction={triggerAction}
          />
        </div>
        {/* Sidebar spacer block */}
        <div className="min-w-[64px] md:min-w-[74px] flex-shrink-0" />
      </div>

      <div className="flex">
        <motion.div
          className="grid gap-2 md:gap-4 w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="popLayout">
            {sortedUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                userId={userId}
                roomId={roomId}
                triggerAction={triggerAction}
                status={status}
                layoutId={user.id}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Sidebar spacer block */}
        <div className="w-[64px] md:w-[74px] flex-shrink-0" />
      </div>
    </div>
  );
};

interface UserCardProps {
  user: User;
  userId: string;
  roomId: number;
  triggerAction: (action: Action) => void;
  status: keyof typeof RoomStateStatus;
  layoutId: string;
}

const UserCard = React.forwardRef<HTMLDivElement, UserCardProps>(
  ({ user, userId, roomId, triggerAction, status, layoutId }, ref) => {
    const hasEstimation = user.estimation !== null;
    const isCurrentUser = user.id === userId;
    const isFlipped = status === RoomStateStatus.flipped;

    // Determine what should be shown on front and back
    const frontContent = hasEstimation ? '✓' : '?';
    // For back content: show estimation for current user or when room is flipped, otherwise show checkmark
    const backContent =
      isCurrentUser || isFlipped ? (user.estimation ?? '?') : '✓';

    // Card should be flipped if:
    // 1. Room is flipped AND user has estimation, OR
    // 2. It's the current user AND they have an estimation (always show own vote)
    const shouldFlip =
      (isFlipped && hasEstimation) ||
      (isCurrentUser && hasEstimation && !isFlipped);

    return (
      <motion.div
        ref={ref}
        layoutId={layoutId}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 25,
        }}
        whileHover={{ scale: 1.02 }}
      >
        <UserHoverCard
          user={user}
          userId={userId}
          roomId={roomId}
          triggerAction={triggerAction}
        >
          <Card
            className={`
            relative min-h-[80px] md:min-h-[120px] transition-all duration-200 py-2 px-1 md:py-4
            ${!user.isPresent ? 'opacity-70' : ''}
            hover:shadow-lg
          `}
            style={{
              borderWidth: '1px',
              borderColor: isCurrentUser ? '#1971c2' : '#424242',
            }}
            withBorder
          >
            <div className="flex flex-col items-center space-y-1 md:space-y-3 h-full">
              <div
                className={`text-xs md:text-sm ${isCurrentUser ? 'font-bold' : 'font-medium'} text-center max-w-full overflow-hidden`}
              >
                <span className={isCurrentUser ? 'font-bold' : ''}>
                  {user.name}
                </span>
              </div>

              {/* Playing card with 3D flip */}
              <div
                className="flex items-center justify-center"
                style={{ perspective: '1000px' }}
              >
                <motion.div
                  className="w-8 h-12 md:w-12 md:h-16 rounded relative"
                  style={{
                    transformStyle: 'preserve-3d',
                  }}
                  animate={{
                    rotateY: shouldFlip ? 180 : 0,
                  }}
                  transition={{
                    duration: 0.6,
                    ease: 'easeInOut',
                  }}
                  key={`card-${user.id}-${user.estimation}`} // Only trigger flip on actual estimation change
                >
                  {/* Front face - flips when hasEstimation changes */}
                  <motion.div
                    className="absolute inset-0 w-8 h-12 md:w-12 md:h-16 rounded border-2 flex items-center justify-center text-xs md:text-sm font-bold"
                    style={{
                      backfaceVisibility: 'hidden',
                      backgroundColor: hasEstimation
                        ? '#22c55e20'
                        : '#ef444420',
                      borderColor: hasEstimation ? '#22c55e' : '#ef4444',
                    }}
                    animate={{
                      rotateY: [0, 90, 0],
                    }}
                    transition={{
                      duration: 0.6,
                      ease: 'easeInOut',
                    }}
                    key={`front-${user.id}-${hasEstimation}`} // Trigger flip on hasEstimation change
                  >
                    {frontContent}
                  </motion.div>

                  {/* Back face - shows estimation only when appropriate */}
                  <motion.div
                    className="absolute inset-0 w-8 h-12 md:w-12 md:h-16 rounded border-2 flex items-center justify-center text-xs md:text-sm font-bold"
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      backgroundColor: 'transparent',
                      borderColor: hasEstimation ? '#22c55e' : '#ef4444',
                    }}
                    animate={{
                      rotateY: [180, 90, 180],
                    }}
                    transition={{
                      duration: 0.6,
                      ease: 'easeInOut',
                    }}
                    key={`back-${user.id}-${hasEstimation}`} // Trigger flip on hasEstimation change
                  >
                    {backContent}
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </Card>
        </UserHoverCard>
      </motion.div>
    );
  },
);

UserCard.displayName = 'UserCard';
