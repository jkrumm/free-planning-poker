import Link from 'next/link';

import { Button, Title } from '@mantine/core';

const PrivacyFeature = (props: { name: string; key: number }) => {
  const { name, key } = props;
  return (
    <div key={key} className="privacy-feature h-[100px] min-w-[80px]">
      <div className="mt-24">
        <p>{name}</p>
      </div>
    </div>
  );
};

export const Privacy = () => {
  return (
    <section
      id="privacy"
      className="border-[6px] mt-44 mb-24 text-center border-solid border-[#2E2E2E] rounded-2xl w-full p-14"
    >
      <Title className="mt-14" order={2}>
        Protecting Your Privacy
      </Title>
      <Title order={3} className="mt-5 font-normal opacity-70">
        Our policies are clear: no personal data stored, no cookies used, fully
        GDPR compliant.
      </Title>
      <Link href={'/imprint'}>
        <Button className="mt-7" variant="outline" color="gray">
          Full Privacy Policy
        </Button>
      </Link>
      <div className="flex justify-evenly mt-10 mb-4">
        {[
          'No cookies',
          'GDPR Compliant',
          'No Personal Data',
          'Anonymized Analytics',
          'Open Source',
        ].map((feature, index) => (
          <PrivacyFeature name={feature} key={index} />
        ))}
      </div>
    </section>
  );
};

export default Privacy;
