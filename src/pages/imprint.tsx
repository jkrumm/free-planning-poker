import { type NextPage } from "next";
import Head from "next/head";
import React from "react";
import { Hero } from "fpp/components/hero";
import Link from "next/link";
import { Button } from "@mantine/core";

const Imprint: NextPage = () => {
  return (
    <>
      <Head>
        <title>Planning Poker - Imprint & Privacy Policy</title>
        <meta
          name="description"
          content="Estimate your story points faster and easier with this free agile scrum sprint planning poker app. Open source and privacy focused."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <meta property="og:title" content="Free Planning Poker" />
        <meta
          property="og:description"
          content="Estimate your story points faster and easier with this free agile scrum sprint planning poker app. Open source and privacy focused."
        />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:url" content="https://free-planning-poker.com/" />
        <meta
          property="og:image"
          content="https://free-planning-poker.com/free-planning-poker.jpg"
        />
        <meta
          property="og:image:secure_url"
          content="https://free-planning-poker.com/free-planning-poker.jpg"
        />
        <meta property="og:image:type" content="image/jpg" />
        <meta property="og:image:width" content="1034" />
        <meta property="og:image:height" content="612" />
        <meta property="og:image:alt" content="Free Planning Poker" />
        <meta charSet="utf-8" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#1971c2" />
        <meta name="msapplication-TileColor" content="#1a1b1e" />
        <meta name="theme-color" content="#1a1b1e" />
      </Head>
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <div className="container flex gap-12 px-4 pt-16 pb-28">
          <div className="md:min-w-[250px]">
            <h1>Imprint</h1>
            <h3>Service Provider</h3>
            Johannes Krumm
            <br />
            Based in Munich, Germany
            <br />
            <br />
            <h3>Contact Information</h3>
            For direct communication,
            <br />
            please visit our contact page <br />
            and fill out the form provided.
            <br />
            <br />
            <Link href="/contact">
              <Button>Contact</Button>
            </Link>
          </div>
          <div>
            <h1>Privacy Policy</h1>
            Our website employs services from Ably, a WebSocket provider. Ably
            assures compliance to SOC 2 Type 2, HIPAA, EU GDPR, and uses 256-bit
            AES Encryption. Ably does not persist or access data in transit,
            thus your information remains solely with you.
            <br />
            <br />
            We use Plausible for website analytics, a service that does not
            track IP addresses and so does not save detailed location
            information. Please note, this service does not necessitate user
            consent due to its GDPR compliance, however, be aware that your site
            activities are captured anonymously and used for improving our
            service.
            <br />
            <br />
            Any personal data you voluntarily send through our contact form
            (name and email) is considered personal data under the General Data
            Protection Regulation (GDPR). This data will be handled
            confidentially and is strictly used for responding to your
            inquiries. No data supplied through the contact form will be used
            for other purposes without your explicit consent.
            <br />
            <br />
            Our website uses a MySQL database operated by Planetscale, running
            against an eu-central-1 hosted AWS MySQL database. All transfers are
            encrypted in transit. This database is used to store room usage and
            voting statistics, but not in association with any specific username
            or individual vote. This information is non-personal and does not
            form part of an identifiable profile.
            <br />
            <br />
            <strong>Usernames</strong> on our service are entirely fictional.
            Any person can view these names and associated votes upon entering a
            room, but these are non-identifiable. Please refrain from using
            genuinely identifiable information as your username to ensure GDPR
            compliance.
            <br />
            <br />
            Usernames and votes are shared with others in the room via Ably
            Websockets. There is no persistence of this data once you leave the
            room or after a period of room inactivity. Our usage of Ably does
            not include history features, negating data persistence. Later
            visitors to the room cannot access usernames or votes from previous
            sessions unless you are actively present in the room.
            <br />
            <br />
            <h1 id="license">Project License</h1>
            The project is licensed under the GNU Affero General Public License
            v3.0 (AGPLv3). This license ensures that derivative work will be
            released under the same license terms, promoting open source sharing
            and improvements. Users can use, modify, and distribute this
            software and its source code, provided they adhere to the license
            terms. You can review the full license terms by clicking the link
            below.
            <br />
            <br />
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/jkrumm/free-planning-poker/blob/master/LICENSE"
            >
              <Button>AGPLv3 license</Button>
            </a>
            <br />
            <br />
            <h1>Donations</h1>
            The link provided for sending money is strictly a voluntarily
            personal PayPal link. Funds received support the maintenance and
            development of this tool. This does not involve any business
            transactions or an exchange of goods or services or financial
            interest.
            <br />
            <br />
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://paypal.me/johanneskrum"
            >
              <Button>Donate</Button>
            </a>
          </div>
        </div>
      </main>
    </>
  );
};

export default Imprint;
