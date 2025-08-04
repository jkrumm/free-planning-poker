import React, { Suspense } from 'react';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

import { Loader } from '@mantine/core';

import { Meta } from 'fpp/components/meta';

const CenteredLoader = () => (
  <div className="fixed top-0 left-0 flex items-center justify-center z-50 h-screen w-screen">
    <Loader variant="bars" />
  </div>
);

const RoomWrapper = dynamic(
  () => import('../../components/room/room-wrapper'),
  {
    ssr: false,
    loading: () => <CenteredLoader />,
  },
);

const RoomPage = () => {
  const router = useRouter();
  const { room } = router.query as { room: string };

  return (
    <div>
      <Meta title={room} robots="noindex,nofollow" />
      <Suspense fallback={<CenteredLoader />}>
        <RoomWrapper />
      </Suspense>
    </div>
  );
};

export default RoomPage;
