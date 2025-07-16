import React from 'react';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

import { Loader } from '@mantine/core';

import { Meta } from 'fpp/components/meta';

const CenteredLoader = () => (
  <div className="flex min-h-screen justify-center">
    <Loader variant="bars" className="my-auto" />
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
    <div className=" md:flex">
      <Meta title={room} robots="noindex,nofollow" />
      <div className="h-full w-full overflow-hidden flex-1">
        <RoomWrapper />
      </div>
    </div>
  );
};

export default RoomPage;
