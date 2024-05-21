import Link from 'next/link';

import { Button, Group, Title } from '@mantine/core';

import { IconBrandGithub } from '@tabler/icons-react';

const PrivacyFeature = (props: { name: string; itemKey: number }) => {
  const { name, itemKey } = props;
  return (
    <div
      key={itemKey}
      className={`${itemKey !== 0 && 'mt-8'} sm:mt-0 privacy-feature h-[100px] min-w-[80px]`}
    >
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
      className="border-[6px] mt-40 mb-32 text-center border-solid border-[#2E2E2E] rounded-2xl w-full p-14"
    >
      <Title className="mt-14" order={2}>
        Protecting Your Privacy
      </Title>
      <Title order={3} className="mt-5 font-normal opacity-70">
        Our policies are clear: no personal data stored, no cookies used, fully
        GDPR compliant.
      </Title>
      <Group justify="center" className="mt-7">
        <Link href={'/imprint'}>
          <Button variant="outline" color="gray">
            Full Privacy Policy
          </Button>
        </Link>
        <a
          href="https://github.com/jkrumm/free-planning-poker"
          target="_blank"
          className="pl-4 text-[#C1C2C5] no-underline visited:text-[#C1C2C5] hover:text-[#1971c2]"
          rel="noopener noreferrer"
        >
          <Button
            variant="outline"
            color="gray"
            leftSection={<IconBrandGithub />}
          >
            GitHub
          </Button>
        </a>
      </Group>
      <div className="flex justify-evenly flex-col sm:flex-row items-center mt-10 mb-4">
        {[
          'No cookies',
          'GDPR Compliant',
          'No Personal Data',
          'Anonymized Analytics',
          'Open Source',
        ].map((feature, index) => (
          <PrivacyFeature name={feature} key={index} itemKey={index} />
        ))}
      </div>
    </section>
  );
};

export default Privacy;
