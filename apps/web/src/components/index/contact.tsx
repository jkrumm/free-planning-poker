import Link from 'next/link';

import { Button, Text, Title } from '@mantine/core';

const Contact = () => {
  return (
    <div className="md:flex gap-10 justify-evenly mt-28 mb-14 text-center">
      <section id="#guide" className="flex-1 mb-20 md:mb:0">
        <Title order={2}>Planning Poker Guide</Title>
        <Text className="mt-5">
          Discover how Planning Poker helps Agile teams efficiently plan sprints
          using story points. Understand the benefits of anonymity and
          gamification in achieving accurate task estimations.
        </Text>
        <Link href={'/guide'}>
          <Button className="mt-7 ml-4" variant="outline" color="gray">
            Planning Poker Guide
          </Button>
        </Link>
      </section>
      <section id="#contact" className="flex-1">
        <Title order={2}>Reach Out to Us</Title>
        <Text className="mt-5">
          Your input is valuable to us!
          <br />
          Feedback, questions, feature suggestions, or if you want to
          contribute, we’re here to listen and assist.
        </Text>
        <Link href={'/contact'}>
          <Button className="mt-7" variant="outline" color="gray">
            Contact Form
          </Button>
        </Link>
      </section>
    </div>
  );
};

export default Contact;
