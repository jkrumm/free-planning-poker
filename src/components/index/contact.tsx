import Link from 'next/link';

import { Button, Title } from '@mantine/core';

const Contact = () => {
  return (
    <section id="#contact" className="text-center my-28">
      <Title order={2}>Reach Out to Us</Title>
      <Title order={3} className="mt-5 font-normal opacity-70">
        Your input is valuable to us!
        <br />
        Feedback, questions, feature suggestions, or you want to contribute,
        we’re here to listen and assist.
        <br />
        In case you want to fully understand the concept of Planning Poker,
        check out our guide.
      </Title>
      <div className="flex justify-center">
        <Link href={'/contact'}>
          <Button className="mt-7" variant="outline" color="gray">
            Contact Form
          </Button>
        </Link>
        <Link href={'/guide'}>
          <Button className="mt-7 ml-4" variant="outline" color="gray">
            Planning Poker Guide
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default Contact;
