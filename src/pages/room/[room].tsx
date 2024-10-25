import React from 'react';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { Alert, Button, Loader, Text } from '@mantine/core';

import { IconAlertCircle } from '@tabler/icons-react';

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
    <>
      <div className="m-8 md:hidden">
        <Alert
          icon={<IconAlertCircle size="1rem" />}
          title="Not supported on mobile devices"
          color="orange"
          variant="outline"
        >
          <Text>
            Free-Planning-Poker.com is not supported on mobile devices. Please
            use a larger device or increase the size of your browser window.
          </Text>
          <Link href="/">
            <Button className="mt-4 block">Back to homepage</Button>
          </Link>
        </Alert>
      </div>
      <div className="max-w-sreen hidden items-start md:flex">
        <Meta title={room} robots="noindex,nofollow" />
        <div className="room-wrapper flex-1">
          <RoomWrapper />
        </div>
      </div>
    </>
  );
};

export default RoomPage;
